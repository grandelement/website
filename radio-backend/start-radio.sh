#!/bin/bash
set -uo pipefail

export HOME=/app/home
export XDG_CACHE_HOME=/app/home/.cache
export GE_DATA_DIR="${GE_DATA_DIR:-/app/data}"

mkdir -p \
  /app/runtime /app/runtime/hls /app/runtime/client_temp /app/runtime/proxy_temp \
  /app/runtime/fastcgi_temp /app/runtime/uwsgi_temp /app/runtime/scgi_temp \
  /app/runtime/uploads /app/logs "$XDG_CACHE_HOME" "$GE_DATA_DIR"

# One low-latency browser contribution bus.
# The control server writes continuous 48 kHz stereo signed-16 PCM here.
# FFmpeg is the only reader. Silence is written whenever the mic is off.
rm -f /app/runtime/mic.pcm /app/runtime/live.active /app/runtime/library.json.tmp
mkfifo -m 600 /app/runtime/mic.pcm
chmod 700 /app/runtime
chmod 600 /app/runtime/mic.pcm

# Runtime gain controls used by the continuous public mixer.
# The control server updates these without restarting Liquidsoap.
printf '1.0\n' > /app/runtime/music.gain
printf '1.0\n' > /app/runtime/direct.gain
printf '1.0\n' > /app/runtime/master.gain

## Persistent station defaults. Existing /app/data settings survive website/backend rebuilds.
if [ ! -f "$GE_DATA_DIR/settings.json" ]; then
  printf '%s\n' '{"legacy": false, "crossfade_seconds": 5.0, "custom_mix_enabled": false, "custom_mix_id": ""}' > "$GE_DATA_DIR/settings.json"
fi
if [ ! -f "$GE_DATA_DIR/custom-playlists.json" ]; then
  if [ -f /app/default-playlists.json ]; then
    cp /app/default-playlists.json "$GE_DATA_DIR/custom-playlists.json"
  else
    printf '%s\n' '{"items": []}' > "$GE_DATA_DIR/custom-playlists.json"
  fi
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
    <clients>40</clients><sources>6</sources><queue-size>32768</queue-size>
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
set("frame.audio.samplerate", 48000)
set("log.file", false)
set("server.telnet", true)
set("server.telnet.bind_addr", "127.0.0.1")
set("server.telnet.port", 1234)

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

# Liquidsoap owns only the automation bed. The public /stream.mp3 mount is
# created below by one continuous FFmpeg mixer that never changes topology.
output.icecast(
  %ffmpeg(format="mp3", %audio(codec="libmp3lame", b="128k")),
  host="127.0.0.1", port=8000, user="source", password="${SOURCE_PASSWORD}",
  mount="/auto.mp3", name="Grand Element Automation Cue", public=false, automation
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

  # Old iOS Safari cannot parse the modern GE DJ JavaScript. Route iOS 10
  # and earlier to the compatibility controller automatically.
  map $http_user_agent $ge_legacy_dj {
    default 0;
    ~*"(iPhone|iPod|iPad).*OS ([1-9]_|10_)" 1;
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

    # iPhone/Safari DJ monitor. HLS uses short HTTP requests instead of one
    # long-lived MP3 response, so an upstream 30-second stream timeout cannot
    # stop the DJ monitor.
    location /hls/ {
      alias /app/runtime/hls/;
      types {
        application/vnd.apple.mpegurl m3u8;
        video/mp2t ts;
      }
      add_header Access-Control-Allow-Origin "*" always;
      add_header Cache-Control "no-store, no-cache, must-revalidate" always;
      add_header Pragma "no-cache" always;
      expires -1;
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

    location = /dj {
      if ($ge_legacy_dj = 1) { return 302 /dj-lite/; }
      root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always;
    }
    location = /dj/ {
      if ($ge_legacy_dj = 1) { return 302 /dj-lite/; }
      root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always;
    }
    location = /dj/index.html {
      if ($ge_legacy_dj = 1) { return 302 /dj-lite/; }
      root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always;
    }
    location = /dj.html {
      if ($ge_legacy_dj = 1) { return 302 /dj-lite/; }
      root /app; try_files /dj.html =404; default_type text/html; add_header Cache-Control "no-store" always;
    }
    location = /dj-lite { return 302 /dj-lite/; }
    location = /dj-lite/ { root /app; try_files /dj-lite.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
    location = /dj-lite.html { root /app; try_files /dj-lite.html =404; default_type text/html; add_header Cache-Control "no-store" always; }
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
    location = /control/realtime-ingest {
      proxy_pass http://127.0.0.1:8090; proxy_http_version 1.1;
      proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";
      proxy_buffering off; proxy_request_buffering off; proxy_connect_timeout 5s;
      proxy_read_timeout 3600s; proxy_send_timeout 3600s; access_log off;
      add_header Cache-Control "no-store" always;
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

NGINX_PID=""; CONTROL_PID=""; WATCHER_PID=""; ICECAST_PID=""; LIQUIDSOAP_PID=""; MASTER_PID=""; HLS_PID=""

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
stop_hls(){
  if pid_alive "$HLS_PID"; then kill "$HLS_PID" 2>/dev/null || true; fi
  HLS_PID=""
}

start_master(){
  if pid_alive "$MASTER_PID"; then return 0; fi
  if ! wait_http "http://127.0.0.1:8000/auto.mp3" 8; then return 1; fi
  echo "GE Radio: starting controllable continuous public mixer (radio + DJ mic + master)..."
  rm -f /app/runtime/master-progress.txt
  MUSIC_GAIN="$(cat /app/runtime/music.gain 2>/dev/null || printf '1.0')"
  DIRECT_GAIN="$(cat /app/runtime/direct.gain 2>/dev/null || printf '1.0')"
  MASTER_GAIN="$(cat /app/runtime/master.gain 2>/dev/null || printf '1.0')"
  ffmpeg -hide_banner -loglevel warning -nostats -stats_period 1 -progress /app/runtime/master-progress.txt \
    -thread_queue_size 2048 -i http://127.0.0.1:8000/auto.mp3 \
    -thread_queue_size 2048 -f s16le -ar 48000 -ac 2 -i /app/runtime/mic.pcm \
    -filter_complex "[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume@musicgain=volume=${MUSIC_GAIN}[music];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume@directgain=volume=${DIRECT_GAIN}[mic];[music][mic]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,volume@mastergain=volume=${MASTER_GAIN},azmq,alimiter=limit=0.95[out]" \
    -map "[out]" -vn -ar 48000 -ac 2 -c:a libmp3lame -b:a 128k \
    -content_type audio/mpeg -f mp3 \
    "icecast://source:${SOURCE_PASSWORD}@127.0.0.1:8000/stream.mp3" & MASTER_PID=$!
  sleep .35
  pid_alive "$MASTER_PID"
}
start_hls(){
  if pid_alive "$HLS_PID"; then return 0; fi
  if ! wait_http "http://127.0.0.1:8000/stream.mp3" 6; then return 1; fi
  rm -f /app/runtime/hls/radio.m3u8 /app/runtime/hls/radio-*.ts
  echo "GE Radio: starting stabilized iPhone HLS monitor (2s segments / 24s live window)..."
  ffmpeg -hide_banner -loglevel warning -nostats \
    -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 2 \
    -i http://127.0.0.1:8000/stream.mp3 \
    -vn -c:a aac -b:a 128k -ar 48000 -ac 2 \
    -f hls -hls_time 2 -hls_list_size 12 -hls_delete_threshold 12 \
    -hls_flags delete_segments+omit_endlist+independent_segments+program_date_time \
    -hls_segment_filename "/app/runtime/hls/radio-%06d.ts" \
    /app/runtime/hls/radio.m3u8 & HLS_PID=$!
  return 0
}

stop_audio(){
  for p in "$MASTER_PID" "$LIQUIDSOAP_PID" "$ICECAST_PID"; do if pid_alive "$p"; then kill "$p" 2>/dev/null || true; fi; done
  sleep .4; MASTER_PID=""; LIQUIDSOAP_PID=""; ICECAST_PID=""
}
start_audio_stack(){
  [ -s /app/runtime/playlist.m3u ] || return 1
  stop_hls
  stop_audio
  echo "GE Radio: starting isolated 24/7 radio backbone..."
  icecast2 -c /app/runtime/icecast.xml & ICECAST_PID=$!
  if ! wait_port 8000 20; then echo "GE Radio: Icecast did not open port 8000; will retry."; stop_audio; return 1; fi

  liquidsoap -t /app/runtime/radio.liq & LIQUIDSOAP_PID=$!
  if ! wait_http "http://127.0.0.1:8000/auto.mp3" 35; then echo "GE Radio: automation cue not ready; will retry."; stop_audio; return 1; fi
  if ! start_master; then echo "GE Radio: public master mixer did not start; will retry."; stop_audio; return 1; fi
  if ! wait_http "http://127.0.0.1:8000/stream.mp3" 35; then echo "GE Radio: mixed public radio not ready; will retry."; stop_audio; return 1; fi

  start_hls || true
  echo "GE Radio: protected 24/7 RADIO online. Public master = controllable continuous radio + microphone mix."
}

shutdown(){
  echo "GE Radio: shutting down..."; stop_hls; stop_audio
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
      echo "GE Radio: radio backbone missing; restarting audio stack."
      start_audio_stack || true
    elif ! pid_alive "$HLS_PID"; then
      echo "GE Radio: HLS DJ monitor stopped; restarting monitor only."
      start_hls || true
    fi
  else
    stop_hls
    if pid_alive "$ICECAST_PID" || pid_alive "$LIQUIDSOAP_PID"; then stop_audio; fi
  fi
  sleep 5
done
