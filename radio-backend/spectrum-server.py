#!/usr/bin/env python3
"""Low-priority, read-only FFT meter for the existing BLITZ Radio 1 master.

The decoder reads Icecast's LOCAL public-master stream, never the microphone
or a parallel playlist. This process does not own, change, or retransmit radio
playback. Safari listeners get frequency data without a second audio player.
"""
import json
import math
import signal
import struct
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SAMPLE_RATE = 8192
FFT_SIZE = 1024
BINS = 256
WINDOW = [0.5 - 0.5 * math.cos(2 * math.pi * i / (FFT_SIZE - 1)) for i in range(FFT_SIZE)]
REVERSE = [int(format(i, "010b")[::-1], 2) for i in range(FFT_SIZE)]
ROOT = [complex(math.cos(-2 * math.pi * i / FFT_SIZE),
                math.sin(-2 * math.pi * i / FFT_SIZE)) for i in range(FFT_SIZE // 2)]
LOCK = threading.Lock()
LAST = {"ready": False, "updated_ms": 0, "bins": [0] * BINS}
PREVIOUS = [0] * BINS
STOP = threading.Event()
DECODER = None

def fft_spectrum(samples):
    """FFT of actual mixed Radio 1 PCM, scaled for the existing 0..255 EQ."""
    a = [complex(samples[REVERSE[i]] * WINDOW[REVERSE[i]], 0) for i in range(FFT_SIZE)]
    size = 2
    while size <= FFT_SIZE:
        half = size // 2
        jump = FFT_SIZE // size
        for start in range(0, FFT_SIZE, size):
            for k in range(half):
                u = a[start + k]
                v = a[start + k + half] * ROOT[k * jump]
                a[start + k] = u + v
                a[start + k + half] = u - v
        size *= 2
    out = []
    for i in range(BINS):
        # Two neighboring FFT buckets -> one real band (0..4096 Hz).
        power = max(abs(a[2 * i]), abs(a[2 * i + 1]))
        normalized = power / (FFT_SIZE * 32768 * .5)
        db = 20 * math.log10(max(normalized, 1e-9))
        level = min(255, max(0, int((db + 82) * 4.1)))
        # Smooth 8 updates/sec for visual continuity, never generate a fake beat.
        level = int(PREVIOUS[i] * .4 + level * .6)
        PREVIOUS[i] = level
        out.append(level)
    return out

def monitor():
    global DECODER
    while not STOP.is_set():
        try:
            DECODER = subprocess.Popen([
                "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
                "-reconnect", "1", "-reconnect_streamed", "1",
                "-reconnect_delay_max", "2",
                "-i", "http://127.0.0.1:8000/stream.mp3",
                "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),
                "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"
            ], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            accumulated = bytearray()
            while not STOP.is_set():
                data = DECODER.stdout.read(FFT_SIZE * 2)
                if not data:
                    break
                accumulated.extend(data)
                while len(accumulated) >= FFT_SIZE * 2:
                    frame = bytes(accumulated[:FFT_SIZE * 2])
                    del accumulated[:FFT_SIZE * 2]
                    samples = struct.unpack("<1024h", frame)
                    bins = fft_spectrum(samples)
                    with LOCK:
                        LAST["ready"] = True
                        LAST["updated_ms"] = int(time.time() * 1000)
                        LAST["bins"] = bins
        except Exception as error:
            print("GE Radio FFT: retry after", str(error), flush=True)
        finally:
            if DECODER:
                try:
                    DECODER.terminate()
                    DECODER.wait(timeout=1)
                except Exception:
                    try: DECODER.kill()
                    except Exception: pass
                DECODER = None
            with LOCK:
                LAST["ready"] = False
                LAST["updated_ms"] = 0
        STOP.wait(3)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/spectrum.json":
            self.send_error(404)
            return
        with LOCK:
            snapshot = dict(LAST)
        snapshot["ready"] = bool(snapshot["ready"] and
                                 int(time.time() * 1000) - snapshot["updated_ms"] < 2500)
        if not snapshot["ready"]:
            snapshot["bins"] = [0] * BINS
        body = json.dumps(snapshot, separators=(",", ":")).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    threading.Thread(target=monitor, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", 8096), Handler)
    server.timeout = 0.75
    try:
        while not STOP.is_set():
            server.handle_request()
    finally:
        STOP.set()
        server.server_close()
        if DECODER:
            try: DECODER.terminate()
            except Exception: pass
