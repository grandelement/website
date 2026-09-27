#!/bin/bash
set -uo pipefail

export HOME=/app/home
export XDG_CACHE_HOME=/app/home/.cache
export GE_DATA_DIR="${GE_DATA_DIR:-/app/data}"

mkdir -p \
  /app/runtime /app/runtime/client_temp /app/runtime/proxy_temp \
  /app/runtime/fastcgi_temp /app/runtime/uwsgi_temp /app/runtime/scgi_temp \
  /app/runtime/uploads /app/logs "$XDG_CACHE_HOME" "$GE_DATA_DIR"

# Low-latency browser contribution bus. The control server writes 48 kHz stereo
# signed-16 PCM here; FFmpeg mixes it into the public master.
rm -f /app/runtime/mic.pcm
mkfifo -m 600 /app/runtime/mic.pcm

## Persistent station defaults. Existing /app/data settings survive website/backend rebuilds.
if [ ! -f "$GE_DATA_DIR/settings.json" ]; then
  printf '%s\n' '{"legacy": false, "crossfade_seconds": 5.0, "custom_mix_enabled": false, "custom_mix_id": ""}' > "$GE_DATA_DIR/settings.json"
fi
if [ ! -f "$GE_DATA_DIR/custom-playlists.json" ]; then
  printf '%s\n' '{"items": []}' > "$GE_DATA_DIR/custom-playlists.json"
fi

SOURCE_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
ADMIN_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
export GE_SOURCE_PASSWORD="$SOURCE_PASSWORD"
HARBOR_PASSWORD_RAW="${DJ_PASSWORD:-$SOURCE_PASSWORD}"
HARBOR_PASSWORD_LIQ="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$HARBOR_PASSWORD_RAW")"

cat > /app/runtime/icecast.xml <<EOF
<icecast>
  <location>GE Studios</location>
  <admin>radio@localhost</admin>
  <limits>
    <clients>40</clients><sources>4</sources><queue-size>32768</queue-size>
    <client-timeout>30</client-timeout><header-timeout>15</header-timeout><source-timeout>10</source-timeout>
    <burst-on-connect>1</burst-on-connect><burst-size>4096</burst-size>
  </limits>
  <authentication>
    <source-password>${SOURCE_PASSWORD}</source-password><relay-password>${SOURCE_PASSWORD}</relay-password>
    <admin-user>admin</admin-user><admin-password>${ADMIN_PASSWORD}</admin-password>
  </authentication>
  <hostname>radio.grandelement.blitz.cloud</hostname>
  <listen-socket><port>8000</port><bind-address>127.0.0.1</bind-address></listen-socket>
  <mount type="normal"><mount-name>/stream.mp3</mount-name><charset>UTF-8</charset><public>0</public></mount>
  <mount type="normal"><mount-name>/base.mp3</mount-name><charset>UTF-8</charset><public>0</public></mount>
  <mount type="normal"><mount-name>/auto.mp3</mount-name><charset>UTF-8</charset><public>0</public></mount>
  <paths>
    <basedir>/usr/share/icecast2</basedir><logdir>/app/logs</logdir>
    <webroot>/usr/share/icecast2/web</webroot><adminroot>/usr/share/icecast2/admin</adminroot>
    <pidfile>/app/runtime/icecast.pid</pidfile><alias source="/stream" destination="/stream.mp3" />
  </paths>
  <logging><accesslog>access.log</accesslog><errorlog>error.log</errorlog><loglevel>2</loglevel><logsize>5000</logsize></logging>
  <security><chroot>0</chroot></security>
</icecast>
EOF

cat > /app/runtime/radio.liq <<EOF
set("log.stdout", true)
set("log.file", false)
set("server.telnet", true)
set("server.telnet.bind_addr", "127.0.0.1")
set("server.telnet.port", 1234)
set("harbor.bind_addr", "127.0.0.1")

def log_song(m)
  file.write(data="#{metadata.json.stringify(m)}", "/app/runtime/now.json")
end

def log_next(r)
  m = request.metadata(r)
  file.write(data="#{metadata.json.stringify(m)}", "/app/runtime/next.json")
  true
end

# Automation remains the always-running backbone and the private music-only cue.
automation = playlist(id="radio", mode="normal", reload_mode="watch", prefetch=1, check_next=log_next, "/app/runtime/playlist.m3u")
automation.on_track(log_song)
automation = crossfade(duration=5., automation)
automation = mksafe(automation)

# Optional Icecast-compatible contribution inputs remain available as a
# fallback for external/native source clients. GE DJ and GE Studio use the
# lower-latency browser WebSocket -> PCM FIFO contribution bus below.
voice = input.harbor("voice", id="ge_voice", port=8095, user="source", password=${HARBOR_PASSWORD_LIQ}, buffer=0.5)
live  = input.harbor("live",  id="ge_live",  port=8095, user="source", password=${HARBOR_PASSWORD_LIQ}, buffer=0.5)

# Voice mode: automation stays running. When the voice source is connected,
# add() automatically mixes the ready voice source with the radio and reduces
# the radio relative to the voice. When voice disconnects, automation returns
# to unity automatically because it is the only ready input.
voice_mix = add(normalize=true, weights=[0.65, 1.0], [automation, voice])

# Performance mode: a complete local stereo mix has priority over everything.
# When it disconnects, the continuously-running automation is immediately back.
master = fallback(track_sensitive=false, [live, voice_mix])
master = mksafe(master)

# Music-only cue for DJ headphones / mix-minus. It never contains returned voice.
output.icecast(
  %ffmpeg(format="mp3", %audio(codec="libmp3lame", b="128k")),
  host="127.0.0.1", port=8000, user="source", password="${SOURCE_PASSWORD}",
  mount="/auto.mp3", name="Grand Element Automation Cue", public=false, automation
)

# Base contribution stream. FFmpeg combines this with the direct browser bus
# and publishes the final /stream.mp3 master.
output.icecast(
  %ffmpeg(format="mp3", %audio(codec="libmp3lame", b="128k")),
  host="127.0.0.1", port=8000, user="source", password="${SOURCE_PASSWORD}",
  mount="/base.mp3", name="Grand Element Base Mix", description="Automation plus optional standard sources",
  genre="Grand Element", public=false, master
)
EOF

cat > /app/runtime/nginx.conf <<'EOF'
worker_processes 1;
pid /app/runtime/nginx.pid;
error_log /app/logs/nginx-error.log warn;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;

  map $http_origin $ge_studio_origin {
    default "";
    "https://grandelement.com" $http_origin;
    "https://www.grandelement.com" $http_origin;
    "https://grandelement.github.io" $http_origin;
  }
  client_body_temp_path /app/runtime/client_temp;
  proxy_temp_path /app/runtime/proxy_temp;
  fastcgi_temp_path /app/runtime/fastcgi_temp;
  uwsgi_temp_path /app/runtime/uwsgi_temp;
  scgi_temp_path /app/runtime/scgi_temp;

  server {
    listen 0.0.0.0:8080;
    server_name _;
    client_max_body_size 105m;

    location = /healthz { default_type text/plain; return 200 "GE Radio gateway OK\n"; }
    location = / { default_type text/plain; return 200 "Grand Element Radio is online.\n"; }

    location = /stream.mp3 {
      proxy_pass http://127.0.0.1:8000/stream.mp3; proxy_http_version 1.1;
      proxy_set_header Host $host; proxy_set_header Connection "";
      proxy_buffering off; proxy_request_buffering off; proxy_cache off;
      proxy_read_timeout 86400s; proxy_send_timeout 86400s; send_timeout 86400s;
      add_header Access-Control-Allow-Origin "*" always;
      add_header Cache-Control "no-store, no-cache, must-revalidate" always;
      add_header X-Accel-Buffering "no" always;
    }
    location = /stream {
      proxy_pass http://127.0.0.1:8000/stream.mp3; proxy_http_version 1.1;
      proxy_set_header Connection ""; proxy_buffering off; proxy_cache off; proxy_read_timeout 86400s;
      add_header Access-Control-Allow-Origin "*" always; add_header Cache-Control "no-store" always; add_header X-Accel-Buffering "no" always;
    }
    location = /dj-cue.mp3 {
      proxy_pass http://127.0.0.1:8000/auto.mp3; proxy_http_version 1.1;
      proxy_set_header Host $host; proxy_set_header Connection "";
      proxy_buffering off; proxy_request_buffering off; proxy_cache off;
      proxy_read_timeout 86400s; proxy_send_timeout 86400s; send_timeout 86400s;
      add_header Access-Control-Allow-Origin "*" always; add_header Cache-Control "no-store" always; add_header X-Accel-Buffering "no" always;
    }

    # Standard source-ingest mounts. Configure an Icecast source client for
    # HTTPS port 443, user "source", the normal DJ password, and one of these
    # public mounts. Nginx terminates TLS and streams the source body directly
    # to Liquidsoap harbor on localhost with buffering disabled.
    location = /source/voice {
      proxy_pass http://127.0.0.1:8095/voice; proxy_http_version 1.1;
      proxy_set_header Host 127.0.0.1:8095; proxy_set_header Authorization $http_authorization;
      proxy_request_buffering off; proxy_buffering off; proxy_cache off;
      proxy_read_timeout 86400s; proxy_send_timeout 86400s; send_timeout 86400s;
      add_header Cache-Control "no-store" always; add_header X-Accel-Buffering "no" always;
    }
    location = /source/live {
      proxy_pass http://127.0.0.1:8095/live; proxy_http_version 1.1;
      proxy_set_header Host 127.0.0.1:8095; proxy_set_header Authorization $http_authorization;
      proxy_request_buffering off; proxy_buffering off; proxy_cache off;
      proxy_read_timeout 86400s; proxy_send_timeout 86400s; send_timeout 86400s;
      add_header Cache-Control "no-store" always; add_header X-Accel-Buffering "no" always;
    }

    location = /dj { root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
    location = /dj/ { root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
    location = /dj/index.html { root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
    location = /dj.html { root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
    location = /live-dj { root /app; try_files /live-dj.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
    location = /live-dj/ { root /app; try_files /live-dj.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
    location = /live-dj.html { root /app; try_files /live-dj.html =404; default_type text/html; add_header Cache-Control "no-store" always; }

    # Low-latency browser contribution path used by GE DJ and GE Studio.
    location = /control/live {
      proxy_pass http://127.0.0.1:8090; proxy_http_version 1.1;
      proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";
      proxy_set_header Origin $http_origin;
      proxy_buffering off; proxy_request_buffering off; proxy_connect_timeout 5s;
      proxy_read_timeout 3600s; proxy_send_timeout 3600s; access_log off;
      add_header Access-Control-Allow-Origin $ge_studio_origin always;
      add_header Vary "Origin" always; add_header Cache-Control "no-store" always;
    }
    location /control/ {
      if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin $ge_studio_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, X-GE-DJ-Key, X-GE-File-Name" always;
        add_header Access-Control-Max-Age 86400 always; add_header Vary "Origin" always;
        return 204;
      }
      proxy_pass http://127.0.0.1:8090; proxy_http_version 1.1;
      proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-GE-DJ-Key $http_x_ge_dj_key; proxy_set_header Connection close;
      proxy_buffering off; proxy_request_buffering off; proxy_connect_timeout 2s;
      proxy_read_timeout 30s; proxy_send_timeout 30s;
      add_header Access-Control-Allow-Origin $ge_studio_origin always;
      add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
      add_header Access-Control-Allow-Headers "Content-Type, X-GE-DJ-Key, X-GE-File-Name" always;
      add_header Vary "Origin" always; add_header Cache-Control "no-store" always;
    }
  }
}
EOF

pid_alive(){ [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }
wait_port(){
  local port="$1" seconds="${2:-20}"
  python3 - "$port" "$seconds" <<'PYWAIT'
import socket,sys,time
p=int(sys.argv[1]); deadline=time.time()+float(sys.argv[2])
while time.time()<deadline:
    s=socket.socket(); s.settimeout(.6)
    try: s.connect(("127.0.0.1",p)); sys.exit(0)
    except OSError: time.sleep(.25)
    finally: s.close()
sys.exit(1)
PYWAIT
}
wait_http(){
  local url="$1" seconds="${2:-25}"
  python3 - "$url" "$seconds" <<'PYHTTP'
import sys,time,urllib.request
u=sys.argv[1]; deadline=time.time()+float(sys.argv[2])
while time.time()<deadline:
    try:
        with urllib.request.urlopen(u,timeout=2) as r:
            if r.status==200: sys.exit(0)
    except Exception: time.sleep(.3)
sys.exit(1)
PYHTTP
}

NGINX_PID=""; CONTROL_PID=""; WATCHER_PID=""; ICECAST_PID=""; LIQUIDSOAP_PID=""; MASTER_PID=""

start_nginx(){
  if pid_alive "$NGINX_PID"; then return 0; fi
  echo "GE Radio: starting public gateway on 0.0.0.0:8080..."
  nginx -c /app/runtime/nginx.conf -g 'daemon off;' & NGINX_PID=$!
  sleep .3; pid_alive "$NGINX_PID"
}
start_control(){
  if pid_alive "$CONTROL_PID"; then return 0; fi
  echo "GE Radio: starting DJ control service..."
  python3 /app/control-server.py & CONTROL_PID=$!
  wait_http "http://127.0.0.1:8090/control/healthz" 12
}
start_watcher(){
  if pid_alive "$WATCHER_PID"; then return 0; fi
  echo "GE Radio: starting library watcher..."
  python3 /app/library-watcher.py & WATCHER_PID=$!
}
stop_audio(){
  for p in "$MASTER_PID" "$LIQUIDSOAP_PID" "$ICECAST_PID"; do if pid_alive "$p"; then kill "$p" 2>/dev/null || true; fi; done
  sleep .4; MASTER_PID=""; LIQUIDSOAP_PID=""; ICECAST_PID=""
}
start_audio_stack(){
  [ -s /app/runtime/playlist.m3u ] || return 1
  stop_audio
  echo "GE Radio: starting internal Icecast..."
  icecast2 -c /app/runtime/icecast.xml & ICECAST_PID=$!
  if ! wait_port 8000 20; then echo "GE Radio: Icecast did not open port 8000; will retry."; stop_audio; return 1; fi

  echo "GE Radio: starting Liquidsoap automation + optional standard source ingest..."
  liquidsoap -t /app/runtime/radio.liq & LIQUIDSOAP_PID=$!
  if ! wait_port 8095 30; then echo "GE Radio: source-ingest harbor did not open port 8095; will retry."; stop_audio; return 1; fi
  if ! wait_http "http://127.0.0.1:8000/auto.mp3" 35; then echo "GE Radio: automation cue not ready; will retry."; stop_audio; return 1; fi
  if ! wait_http "http://127.0.0.1:8000/base.mp3" 35; then echo "GE Radio: base mix not ready; will retry."; stop_audio; return 1; fi

  local filter
  if ffmpeg -hide_banner -filters 2>/dev/null | grep -q " azmq "; then
    filter='[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume@musicgain=volume=1.0[music];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume@directgain=volume=1.0[direct];[direct]asplit=2[side][live];[music][side]sidechaincompress@duck=threshold=0.010:ratio=10:attack=12:release=550:mix=0.55[ducked];[ducked][live]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95,volume@mastergain=volume=1.0,azmq[out]'
    echo "GE Radio: browser live mixer controls enabled."
  else
    filter='[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[music];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[direct];[direct]asplit=2[side][live];[music][side]sidechaincompress=threshold=0.010:ratio=10:attack=12:release=550[ducked];[ducked][live]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95[out]'
    echo "GE Radio: WARNING: FFmpeg azmq unavailable; direct browser audio still works with static radio ducking."
  fi

  echo "GE Radio: starting final public master with direct browser contribution bus..."
  ffmpeg -hide_banner -loglevel warning -nostats -fflags nobuffer \
    -thread_queue_size 512 -i http://127.0.0.1:8000/base.mp3 \
    -thread_queue_size 128 -f s16le -ar 48000 -ac 2 -i /app/runtime/mic.pcm \
    -filter_complex "$filter" -map '[out]' -ar 48000 -ac 2 -c:a libmp3lame -b:a 128k \
    -flush_packets 1 -content_type audio/mpeg -f mp3 \
    "icecast://source:${SOURCE_PASSWORD}@127.0.0.1:8000/stream.mp3" & MASTER_PID=$!

  if ! wait_http "http://127.0.0.1:8000/stream.mp3" 35; then echo "GE Radio: final public master not ready; will retry."; stop_audio; return 1; fi

  python3 - <<'PYMIX' || true
import json, pathlib, zmq
p=pathlib.Path("/app/data/mixer.json")
try: s=json.loads(p.read_text())
except Exception: s={"music_level":1.0,"music_under_voice":0.45,"music_muted":False}
music=0.0 if s.get("music_muted") else float(s.get("music_level",1.0))
duck=1.0-float(s.get("music_under_voice",0.45))
ctx=zmq.Context.instance()
direct=float(s.get("direct_level",1.0)); master=float(s.get("master_level",1.0))
for target,cmd,val in [("volume@musicgain","volume",music),("sidechaincompress@duck","mix",duck),("volume@directgain","volume",direct),("volume@mastergain","volume",master)]:
    q=ctx.socket(zmq.REQ); q.setsockopt(zmq.LINGER,0); q.setsockopt(zmq.SNDTIMEO,1000); q.setsockopt(zmq.RCVTIMEO,1000)
    try:
        q.connect("tcp://127.0.0.1:5555"); q.send_string(f"{target} {cmd} {val:.4f}"); q.recv_string()
    except Exception: pass
    q.close(0)
PYMIX

  echo "GE Radio: automation, browser MIC/LINE/STUDIO bus, optional source inputs, and public master are online."
}

shutdown(){
  echo "GE Radio: shutting down..."; stop_audio
  for p in "$CONTROL_PID" "$WATCHER_PID" "$NGINX_PID"; do if pid_alive "$p"; then kill "$p" 2>/dev/null || true; fi; done
  wait 2>/dev/null || true
}
trap shutdown EXIT INT TERM

start_nginx || { echo "GE Radio: gateway failed to start."; exit 1; }
start_control || echo "GE Radio: control service startup warning; supervisor will retry."
start_watcher

echo "GE Radio: gateway online; waiting for library playlist in background."
while true; do
  if ! pid_alive "$NGINX_PID"; then start_nginx || true; fi
  if ! pid_alive "$CONTROL_PID"; then start_control || true; fi
  if ! pid_alive "$WATCHER_PID"; then start_watcher || true; fi
  if [ -s /app/runtime/playlist.m3u ]; then
    if ! pid_alive "$ICECAST_PID" || ! pid_alive "$LIQUIDSOAP_PID" || ! pid_alive "$MASTER_PID"; then
      echo "GE Radio: audio stack missing or stopped; starting/restarting it."
      start_audio_stack || true
    fi
  else
    if pid_alive "$ICECAST_PID" || pid_alive "$LIQUIDSOAP_PID" || pid_alive "$MASTER_PID"; then stop_audio; fi
  fi
  sleep 5
done
