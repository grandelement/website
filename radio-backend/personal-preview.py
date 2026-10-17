#!/usr/bin/env python3
"""Per-listener MP3 preview: server-side iPhone-safe fade and rising reverb.

Streams the normal BLITZ program untouched until the final 130 seconds;
only the specific preview connection gets FFmpeg convolution reverb near its Gate.
No changes to the shared mixer, playlist, or other listeners.
"""
import http.server
import json
import logging
import os
import subprocess
import threading
import time
import urllib.parse
import urllib.request

HOST = '127.0.0.1'
PORT = int(os.environ.get('GE_PREVIEW_PORT', '8091'))
SOURCE = os.environ.get('GE_PREVIEW_SOURCE', 'http://127.0.0.1:8000/stream.mp3')
FADE_SECONDS = 10.0
PROCESS_BEFORE_FADE_SECONDS = 8.0
GATE_SETTINGS = os.environ.get("GE_GATE_SETTINGS_PATH", "/app/data/gate-settings.json")


def listener_fade_settings():
    # Separate preview requests pick up Back Room settings automatically.
    try:
        with open(GATE_SETTINGS, encoding="utf-8") as stream:
            value = json.load(stream)
        fade = float(value.get("fade_seconds", FADE_SECONDS))
        # A persisted stock 11/60 profile must never revive the old fade.
        if (value.get("timing_version") != "gate-2s-10s-v2"
                and value.get("fade_delay_seconds") == 11 and fade == 60):
            fade = FADE_SECONDS
        reverb = float(value.get("reverb_level", 2.4))
        if not (10 <= fade <= 180 and 0 <= reverb <= 4):
            raise ValueError("Invalid gate settings")
        return fade, reverb
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return FADE_SECONDS, 2.4
MAX_SECONDS = 2013
MAX_LISTENERS = 35
MAX_FX = 3
IR_PATH = os.environ.get('GE_GATE_IR_PATH', '/app/runtime/gate-reverb-ir.wav')
LOCK = threading.Lock()
LISTENERS = {}
FX = threading.BoundedSemaphore(MAX_FX)


def ensure_gate_impulse():
    """Build a true, diffuse stereo reverb impulse for this server only.

    The file never changes the public station audio. Generated once at startup
    with Python's standard library, so no external IR download is required.
    """
    import math
    import random
    import struct
    import wave

    sample_rate = 48000
    frame_count = int(sample_rate * 1.50)
    rng = (random.Random(4033), random.Random(4067))
    smooth = [0.0, 0.0]
    pcm = bytearray()
    for i in range(frame_count):
        seconds = i / sample_rate
        left_right = []
        for channel in range(2):
            # Dense decaying reflections, deliberately not distinct tap echoes.
            noise = rng[channel].uniform(-1.0, 1.0)
            smooth[channel] = 0.45 * smooth[channel] + 0.55 * noise
            envelope = math.exp(-4.6 * seconds)
            diffuse = 0.0 if seconds < 0.014 else smooth[channel] * 0.013 * envelope
            early = 0.0
            for delay, strength in ((0.028, 0.11), (0.042, 0.09), (0.064, 0.06)):
                if i == int((delay + channel * 0.004) * sample_rate):
                    early += strength
            left_right.append(int(max(-0.99, min(0.99, diffuse + early)) * 32767))
        pcm.extend(struct.pack('<hh', *left_right))
    os.makedirs(os.path.dirname(IR_PATH) or '.', exist_ok=True)
    temp_path = IR_PATH + '.new'
    with wave.open(temp_path, 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm)
    os.replace(temp_path, IR_PATH)


def reverb_filter(remaining, fade_seconds=FADE_SECONDS, reverb_level=2.4):
    """Two INVISIBLE listener-only faders: music dry down, real reverb up.

    Do not touch the broadcast mixer or HTMLAudioElement.volume (unreliable on
    iPhone). Until the center/question + 2-second grace have passed, the
    unprocessed dry path stays at 100% and the reverb remains at zero.
    Both buses reach absolute silence at the listener's 33:33 deadline.
    """
    remaining = max(0.1, min(float(remaining), MAX_SECONDS))
    before = max(0.0, remaining - fade_seconds)
    done = max(0.0, fade_seconds - remaining)
    progress = f'min(1,max(0,(t+{done:.4f}-{before:.4f})/{fade_seconds:.4f}))'
    dry = f'pow(max(0,1-({progress})),1.55)'
    # The Back Room adjusts the multi-reflection room bus; 2.4 -> 0.42.
    # Wet/dry RATIO grows all ten seconds while combined loudness declines.
    wet_level = 0.175 * max(0.0, min(4.0, reverb_level))
    wet = f'{wet_level:.5f}*pow(({progress}),1.1)*pow(max(0,1-({progress})),1.10)'
    return (
        '[0:a]asetpts=PTS-STARTPTS,aresample=48000,'
        'aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=2[dry][wet];'
        f"[dry]volume='{dry}':eval=frame[d];"
        '[wet]aecho=0.65:0.75:29|43|71|101|149|223:0.40|0.36|0.25|0.20|0.12|0.08,'
        'aecho=0.75:0.55:17|23|31:0.20|0.18|0.14,'
        'highpass=f=140,lowpass=f=8200,'
        f"volume='{wet}':eval=frame[w];"
        '[d][w]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,'
        f'alimiter=limit=0.95,afade=t=out:st={max(0,remaining-0.45):.4f}:'
        f'd={min(0.25,max(0.05,remaining-0.16)):.4f}:curve=tri[out]'
    )


def mp3_frame_size(head):
    """Keep MP3 frames intact when crossing from passthrough to re-encoding."""
    if len(head) < 4 or head[0] != 0xFF or (head[1] & 0xE0) != 0xE0:
        return 0
    version = (head[1] >> 3) & 3
    layer = (head[1] >> 1) & 3
    bitrate_id = (head[2] >> 4) & 15
    frequency_id = (head[2] >> 2) & 3
    if version == 1 or layer != 1 or bitrate_id in (0, 15) or frequency_id == 3:
        return 0
    bitrates = (
        (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320)
        if version == 3 else
        (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160)
    )
    sample_rate = (44100, 48000, 32000)[frequency_id] // (
        1 if version == 3 else 2 if version == 2 else 4
    )
    size = ((144 if version == 3 else 72) * bitrates[bitrate_id] * 1000) // sample_rate + ((head[2] >> 1) & 1)
    return size if 24 <= size <= 2000 else 0


def listener_enter(ip):
    with LOCK:
        if sum(LISTENERS.values()) >= MAX_LISTENERS or LISTENERS.get(ip, 0) >= 2:
            return False
        LISTENERS[ip] = LISTENERS.get(ip, 0) + 1
        return True


def listener_exit(ip):
    with LOCK:
        count = LISTENERS.get(ip, 0)
        if count <= 1:
            LISTENERS.pop(ip, None)
        else:
            LISTENERS[ip] = count - 1


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        logging.info('listener-preview: ' + fmt, *args)

    def respond(self, status, *, audio=False):
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Expose-Headers', 'X-GE-Listener-Preview, X-GE-Listener-Preview-Version')
        self.send_header('X-GE-Listener-Preview', '1')
        self.send_header('X-GE-Listener-Preview-Version', 'gate-2s-10s-v2')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Connection', 'close')
        if audio:
            self.send_header('Content-Type', 'audio/mpeg')
        else:
            self.send_header('Content-Length', '0')
        self.end_headers()
        self.close_connection = True

    def do_OPTIONS(self):
        self.respond(204)

    def do_HEAD(self):
        if urllib.parse.urlsplit(self.path).path != '/listener-preview.mp3':
            self.respond(404)
            return
        self.respond(200)

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path != '/listener-preview.mp3':
            self.respond(404)
            return
        try:
            values = urllib.parse.parse_qs(parsed.query, strict_parsing=True)
            raw = values.get('remaining', [''])[0]
            if not raw.isdigit():
                raise ValueError('bad remaining')
            remaining = int(raw)
            if not 1 <= remaining <= MAX_SECONDS:
                raise ValueError('remaining outside preview')
        except (ValueError, OverflowError):
            self.respond(400)
            return
        ip = self.headers.get('X-Real-IP', self.client_address[0])
        if not listener_enter(ip):
            self.respond(429)
            return
        try:
            self.respond(200, audio=True)
            self.stream_for(remaining)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception:
            logging.exception('listener-preview: listener stream failed')
        finally:
            listener_exit(ip)

    def send_clean(self, until):
        if time.monotonic() >= until:
            return True
        request = urllib.request.Request(
            SOURCE, headers={'User-Agent': 'GE-Personal-Preview/1.0', 'Icy-MetaData': '0'}
        )
        with urllib.request.urlopen(request, timeout=12) as upstream:
            pending = bytearray()
            while time.monotonic() < until:
                chunk = upstream.read(2048)
                if not chunk:
                    return False
                pending.extend(chunk)
                while len(pending) >= 4 and time.monotonic() < until:
                    size = mp3_frame_size(pending)
                    if not size:
                        del pending[0]
                        continue
                    if len(pending) < size:
                        break
                    self.wfile.write(pending[:size])
                    del pending[:size]
        return True

    def send_processed(self, remaining, fade_seconds, reverb_level, absolute_deadline):
        if not FX.acquire(blocking=False):
            logging.warning('listener-preview: FX capacity reached; stopping this preview')
            return
        process = None
        try:
            args = [
                'ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
                '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '2',
                '-i', SOURCE, '-t', f'{remaining:.3f}',
                '-filter_complex', reverb_filter(remaining, fade_seconds, reverb_level),
                '-map', '[out]', '-vn', '-threads', '1',
                '-c:a', 'libmp3lame', '-b:a', '128k',
                '-write_xing', '0', '-id3v2_version', '0', '-write_id3v1', '0',
                '-f', 'mp3', 'pipe:1',
            ]
            process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            import select
            while True:
                left = absolute_deadline - time.monotonic()
                if left <= 0:
                    break
                ready, _, _ = select.select([process.stdout], [], [], min(0.15, left))
                if not ready:
                    continue
                chunk = os.read(process.stdout.fileno(), 2048)
                if not chunk:
                    break
                self.wfile.write(chunk)
        finally:
            if process is not None:
                if process.poll() is None:
                    process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
                if process.stdout:
                    process.stdout.close()
            FX.release()

    def stream_for(self, remaining):
        deadline = time.monotonic() + remaining
        fade_seconds, reverb_level = listener_fade_settings()
        start_fx = deadline - (fade_seconds + PROCESS_BEFORE_FADE_SECONDS)
        if start_fx > time.monotonic() and not self.send_clean(start_fx):
            return
        remaining = max(0.0, deadline - time.monotonic())
        if remaining > 0:
            self.send_processed(remaining, fade_seconds, reverb_level, deadline)


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
    logging.info('GE personal preview listening on %s:%d', HOST, PORT)
    Server((HOST, PORT), Handler).serve_forever(poll_interval=0.5)
