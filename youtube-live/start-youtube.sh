#!/bin/sh
set -eu

: "${YOUTUBE_STREAM_KEY:?Set YOUTUBE_STREAM_KEY as a secret environment variable}"

GE_LIVE_URL="${GE_LIVE_URL:-https://www.grandelement.com/live/?mute=1}"
GE_RADIO_STREAM="${GE_RADIO_STREAM:-https://radio.grandelement.blitz.cloud/stream.mp3}"
YOUTUBE_INGEST="${YOUTUBE_INGEST:-rtmps://a.rtmps.youtube.com/live2}"
DISPLAY="${DISPLAY:-:99}"
VIDEO_SIZE="${VIDEO_SIZE:-1920x1080}"
FPS="${FPS:-30}"
VIDEO_BITRATE="${VIDEO_BITRATE:-6000k}"
VIDEO_MAXRATE="${VIDEO_MAXRATE:-6500k}"
VIDEO_BUFSIZE="${VIDEO_BUFSIZE:-12000k}"
AUDIO_BITRATE="${AUDIO_BITRATE:-128k}"

cleanup() {
  kill "${CHROME_PID:-}" "${XVFB_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "GE YouTube Live: starting virtual 1920x1080 broadcast room..."
Xvfb "$DISPLAY" -screen 0 "${VIDEO_SIZE}x24" -ac -nolisten tcp &
XVFB_PID=$!
sleep 2

echo "GE YouTube Live: opening GE Live visual shell..."
chromium   --no-sandbox   --disable-dev-shm-usage   --disable-session-crashed-bubble   --disable-infobars   --disable-translate   --autoplay-policy=no-user-gesture-required   --window-size=1920,1080   --window-position=0,0   --kiosk   "$GE_LIVE_URL" >/tmp/chromium.log 2>&1 &
CHROME_PID=$!
sleep 8

echo "GE YouTube Live: sending GE Live video + GE Radio audio to YouTube..."
exec ffmpeg   -hide_banner -loglevel warning -stats   -f x11grab -draw_mouse 0 -framerate "$FPS" -video_size "$VIDEO_SIZE" -i "$DISPLAY.0+0,0"   -thread_queue_size 2048   -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 -i "$GE_RADIO_STREAM"   -map 0:v:0 -map 1:a:0   -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p   -r "$FPS" -g "$((FPS*2))" -keyint_min "$((FPS*2))" -sc_threshold 0   -b:v "$VIDEO_BITRATE" -maxrate "$VIDEO_MAXRATE" -bufsize "$VIDEO_BUFSIZE"   -c:a aac -b:a "$AUDIO_BITRATE" -ar 48000 -ac 2   -af "aresample=async=1:first_pts=0"   -f flv "${YOUTUBE_INGEST}/${YOUTUBE_STREAM_KEY}"
