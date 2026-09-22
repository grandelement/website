#!/bin/bash
set -euo pipefail

export HOME=/app/home
export XDG_CACHE_HOME=/app/home/.cache

mkdir -p \
  /app/runtime \
  /app/runtime/client_temp \
  /app/runtime/proxy_temp \
  /app/runtime/fastcgi_temp \
  /app/runtime/uwsgi_temp \
  /app/runtime/scgi_temp \
  /app/runtime/uploads \
  /app/logs \
  "$XDG_CACHE_HOME"

rm -f /app/runtime/mic.pcm
mkfifo -m 600 /app/runtime/mic.pcm

if [ ! -f /app/runtime/settings.json ]; then
  printf '%s\n' '{"legacy": false, "crossfade_seconds": 5.0, "custom_mix_enabled": false, "custom_mix_id": ""}' > /app/runtime/settings.json
fi
if [ ! -f /app/runtime/custom-playlists.json ]; then
  printf '%s\n' '{"items": []}' > /app/runtime/custom-playlists.json
fi

SOURCE_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
ADMIN_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"

echo "GE Radio: building Core rotation from the Grand Element GitHub library..."
python3 /app/library-watcher.py &
WATCHER_PID=$!

for _ in $(seq 1 90); do
  if [ -s /app/runtime/playlist.m3u ]; then
    break
  fi
  if ! kill -0 "$WATCHER_PID" 2>/dev/null; then
    echo "GE Radio: rotation watcher stopped before creating a playlist."
    exit 1
  fi
  sleep 1
done

if [ ! -s /app/runtime/playlist.m3u ]; then
  echo "GE Radio: could not create the initial playlist."
  exit 1
fi

cat > /app/runtime/icecast.xml <<EOF
<icecast>
  <location>GE Studios</location>
  <admin>radio@localhost</admin>
  <limits>
    <clients>100</clients>
    <sources>4</sources>
    <queue-size>131072</queue-size>
    <client-timeout>30</client-timeout>
    <header-timeout>15</header-timeout>
    <source-timeout>10</source-timeout>
    <burst-on-connect>1</burst-on-connect>
    <burst-size>8192</burst-size>
  </limits>
  <authentication>
    <source-password>${SOURCE_PASSWORD}</source-password>
    <relay-password>${SOURCE_PASSWORD}</relay-password>
    <admin-user>admin</admin-user>
    <admin-password>${ADMIN_PASSWORD}</admin-password>
  </authentication>
  <hostname>radio.grandelement.blitz.cloud</hostname>
  <listen-socket>
    <port>8000</port>
    <bind-address>127.0.0.1</bind-address>
  </listen-socket>
  <mount type="normal">
    <mount-name>/stream.mp3</mount-name>
    <charset>UTF-8</charset>
    <public>0</public>
  </mount>
  <mount type="normal">
    <mount-name>/auto.mp3</mount-name>
    <charset>UTF-8</charset>
    <public>0</public>
  </mount>
  <mount type="normal">
    <mount-name>/mic.mp3</mount-name>
    <charset>UTF-8</charset>
    <public>0</public>
  </mount>
  <paths>
    <basedir>/usr/share/icecast2</basedir>
    <logdir>/app/logs</logdir>
    <webroot>/usr/share/icecast2/web</webroot>
    <adminroot>/usr/share/icecast2/admin</adminroot>
    <pidfile>/app/runtime/icecast.pid</pidfile>
    <alias source="/stream" destination="/stream.mp3" />
  </paths>
  <logging>
    <accesslog>access.log</accesslog>
    <errorlog>error.log</errorlog>
    <loglevel>2</loglevel>
    <logsize>10000</logsize>
  </logging>
  <security><chroot>0</chroot></security>
</icecast>
EOF

cat > /app/runtime/radio.liq <<EOF
set("log.stdout", true)
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

radio = playlist(
  id="radio",
  mode="normal",
  reload_mode="watch",
  prefetch=1,
  check_next=log_next,
  "/app/runtime/playlist.m3u"
)

radio.on_track(log_song)

# Normal transition time is supplied by playlist metadata from the DJ control.
# The playlist tags station-ID boundaries with a shorter 1.2-second transition.
radio = crossfade(duration=5., radio)
radio = mksafe(radio)

output.icecast(
  %ffmpeg(format="mp3", %audio(codec="libmp3lame", b="128k")),
  host="127.0.0.1",
  port=8000,
  user="source",
  password="${SOURCE_PASSWORD}",
  mount="/auto.mp3",
  name="Grand Element Automation",
  description="Grand Element 24/7 Radio",
  genre="Grand Element",
  public=false,
  radio
)
EOF

cat > /app/runtime/nginx.conf <<'EOF'
worker_processes 1;
pid /app/runtime/nginx.pid;
error_log /dev/stderr info;

events { worker_connections 1024; }

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log /dev/stdout;

  client_body_temp_path /app/runtime/client_temp;
  proxy_temp_path /app/runtime/proxy_temp;
  fastcgi_temp_path /app/runtime/fastcgi_temp;
  uwsgi_temp_path /app/runtime/uwsgi_temp;
  scgi_temp_path /app/runtime/scgi_temp;

  server {
    listen 0.0.0.0:8080;
    server_name _;
    client_max_body_size 105m;

    location = /healthz {
      default_type text/plain;
      return 200 "GE Radio OK\n";
    }

    location = / {
      default_type text/plain;
      return 200 "Grand Element Radio is online.\n";
    }

    location = /stream.mp3 {
      proxy_pass http://127.0.0.1:8000/stream.mp3;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header Connection "";
      proxy_buffering off;
      proxy_request_buffering off;
      proxy_cache off;
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
      send_timeout 86400s;
      add_header Access-Control-Allow-Origin "*" always;
      add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
      add_header Access-Control-Allow-Headers "Origin, Range, Accept, Content-Type" always;
      add_header Cache-Control "no-store, no-cache, must-revalidate" always;
      add_header X-Accel-Buffering "no" always;
    }

    location = /stream {
      proxy_pass http://127.0.0.1:8000/stream.mp3;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_buffering off;
      proxy_cache off;
      proxy_read_timeout 86400s;
      add_header Access-Control-Allow-Origin "*" always;
      add_header Cache-Control "no-store, no-cache, must-revalidate" always;
      add_header X-Accel-Buffering "no" always;
    }

    # DJ headphone cue: automation music only, before the live mic is mixed.
    # This prevents delayed self-voice echo while the DJ is on air.
    location = /dj-cue.mp3 {
      proxy_pass http://127.0.0.1:8000/auto.mp3;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header Connection "";
      proxy_buffering off;
      proxy_request_buffering off;
      proxy_cache off;
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
      send_timeout 86400s;
      add_header Access-Control-Allow-Origin "*" always;
      add_header Cache-Control "no-store, no-cache, must-revalidate" always;
      add_header X-Accel-Buffering "no" always;
    }

    location = /dj {
      root /app;
      try_files /dj.html =404;
      default_type text/html;
      add_header Cache-Control "no-store" always;
    }

    location = /dj/ {
      root /app;
      try_files /dj.html =404;
      default_type text/html;
      add_header Cache-Control "no-store" always;
    }

    location = /dj/index.html {
      root /app;
      try_files /dj.html =404;
      default_type text/html;
      add_header Cache-Control "no-store" always;
    }

    location = /dj.html {
      root /app;
      try_files /dj.html =404;
      default_type text/html;
      add_header Cache-Control "no-store" always;
    }

    location = /control/live {
      proxy_pass http://127.0.0.1:8090;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_buffering off;
      proxy_request_buffering off;
      proxy_connect_timeout 5s;
      proxy_read_timeout 3600s;
      proxy_send_timeout 3600s;
      access_log off;
      add_header Cache-Control "no-store" always;
    }

    location /control/ {
      proxy_pass http://127.0.0.1:8090;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-GE-DJ-Key $http_x_ge_dj_key;
      proxy_set_header Connection close;
      proxy_buffering off;
      proxy_request_buffering off;
      proxy_connect_timeout 2s;
      proxy_read_timeout 5s;
      proxy_send_timeout 5s;
      add_header Cache-Control "no-store" always;
    }
  }
}
EOF

echo "GE Radio: starting internal Icecast..."
icecast2 -c /app/runtime/icecast.xml &
ICECAST_PID=$!

python3 - <<'PY'
import socket, time
deadline=time.time()+30
while time.time()<deadline:
    s=socket.socket(); s.settimeout(1)
    try:
        s.connect(("127.0.0.1",8000))
        print("GE Radio: Icecast ready.", flush=True)
        break
    except OSError:
        time.sleep(.5)
    finally:
        s.close()
else:
    raise SystemExit("GE Radio: Icecast did not open internal port 8000.")
PY

echo "GE Radio: starting automated DJ with adjustable crossfade..."
liquidsoap -t /app/runtime/radio.liq &
LIQUIDSOAP_PID=$!

echo "GE Radio: starting private DJ control service..."
export GE_SOURCE_PASSWORD="$SOURCE_PASSWORD"
python3 /app/control-server.py &
CONTROL_PID=$!

python3 - <<'PY'
import time, urllib.request
deadline = time.time() + 15
while time.time() < deadline:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8090/control/healthz", timeout=2) as r:
            if r.status == 200:
                print("GE Radio: DJ control service ready.", flush=True)
                break
    except Exception:
        time.sleep(.25)
else:
    raise SystemExit("GE Radio: DJ control service did not become ready.")
PY

echo "GE Radio: waiting for automation source..."
python3 - <<'PY'
import time, urllib.request
url = "http://127.0.0.1:8000/auto.mp3"
deadline = time.time() + 30
while time.time() < deadline:
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            if r.status == 200:
                print("GE Radio: source ready: auto.mp3", flush=True)
                break
    except Exception:
        time.sleep(.35)
else:
    raise SystemExit("GE Radio: automation source did not become ready.")
PY

echo "GE Radio: starting master mixer with automatic DJ ducking..."
if ffmpeg -hide_banner -filters 2>/dev/null | grep -q " azmq "; then
  MASTER_FILTER='[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume@musicgain=volume=1.0[music];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[micbase];[micbase]asplit=2[micsc][micmix];[music][micsc]sidechaincompress@duck=threshold=0.012:ratio=12:attack=15:release=650:mix=0.55[ducked];[ducked][micmix]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95,azmq[out]'
  echo "GE Radio: live music mixer controls enabled."
else
  MASTER_FILTER='[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[music];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[micbase];[micbase]asplit=2[micsc][micmix];[music][micsc]sidechaincompress=threshold=0.012:ratio=12:attack=15:release=650[ducked];[ducked][micmix]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95[out]'
  echo "GE Radio: WARNING: FFmpeg azmq filter unavailable; using safe static mixer so the station can still start."
fi

ffmpeg -hide_banner -loglevel warning -fflags nobuffer \
  -thread_queue_size 1024 -i http://127.0.0.1:8000/auto.mp3 \
  -thread_queue_size 256 -f s16le -ar 48000 -ac 2 -i /app/runtime/mic.pcm \
  -filter_complex "$MASTER_FILTER" \
  -map "[out]" -ar 48000 -ac 2 -c:a libmp3lame -b:a 128k \
  -flush_packets 1 -content_type audio/mpeg -f mp3 \
  "icecast://source:${SOURCE_PASSWORD}@127.0.0.1:8000/stream.mp3" &
MASTER_PID=$!

python3 - <<'PY'
import time, urllib.request
deadline = time.time() + 30
url = "http://127.0.0.1:8000/stream.mp3"
while time.time() < deadline:
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            if r.status == 200:
                print("GE Radio: master stream ready on /stream.mp3.", flush=True)
                break
    except Exception:
        time.sleep(.35)
else:
    raise SystemExit("GE Radio: master stream did not become ready.")
PY

echo "GE Radio: starting public gateway on port 8080..."
nginx -c /app/runtime/nginx.conf -g 'daemon off;' &
NGINX_PID=$!

shutdown() {
  kill "$NGINX_PID" "$MASTER_PID" "$CONTROL_PID" "$LIQUIDSOAP_PID" "$ICECAST_PID" "$WATCHER_PID" 2>/dev/null || true
  wait "$NGINX_PID" "$MASTER_PID" "$CONTROL_PID" "$LIQUIDSOAP_PID" "$ICECAST_PID" "$WATCHER_PID" 2>/dev/null || true
}
trap shutdown EXIT INT TERM

while kill -0 "$NGINX_PID" 2>/dev/null \
   && kill -0 "$MASTER_PID" 2>/dev/null \
   && kill -0 "$CONTROL_PID" 2>/dev/null \
   && kill -0 "$ICECAST_PID" 2>/dev/null \
   && kill -0 "$LIQUIDSOAP_PID" 2>/dev/null \
   && kill -0 "$WATCHER_PID" 2>/dev/null; do
  sleep 5
done

echo "GE Radio: a core process stopped."
exit 1
