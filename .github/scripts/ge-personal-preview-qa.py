#!/usr/bin/env python3
"""Local-only smoke checks for the individual listener Gate audio path."""
import array
import importlib.util
import math
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[2]
script = root / 'radio-backend' / 'personal-preview.py'
spec = importlib.util.spec_from_file_location('ge_personal_preview', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.mp3_frame_size(bytes.fromhex('fffb9400')) == 384
assert module.mp3_frame_size(b'BAD!') == 0
assert 'aecho=' in module.reverb_filter(130)
assert 'afade=t=out:st=120.0000:d=10.0000' in module.reverb_filter(130)
assert 't+0.0000-120.0000' in module.reverb_filter(130)
assert 't+5.0000-0.0000' in module.reverb_filter(5)

docker = (root / 'Dockerfile.radio').read_text()
shell = (root / 'radio-backend/start-radio.sh').read_text()
radio = (root / 'radio/index.html').read_text()
assert 'radio-backend/personal-preview.py' in docker
assert 'location = /listener-preview.mp3 {' in shell
assert 'start_preview()' in shell
assert 'GE_LISTENER_PREVIEW_URL' in radio
assert 'GEListenerPreview' in radio
assert "method:'HEAD'" in radio

if not shutil.which('ffmpeg'):
    raise SystemExit('FFmpeg is needed to verify the actual audio fade')
module.FADE_SECONDS = 2.0
output = subprocess.run([
    'ffmpeg', '-v', 'error',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
    '-filter_complex', module.reverb_filter(2),
    '-map', '[out]', '-c:a', 'pcm_f32le', '-f', 'f32le', '-'
], capture_output=True, check=True).stdout
samples = array.array('f')
samples.frombytes(output)
assert len(samples) > 150000, len(samples)
def rms_at(t):
    start = int(t * 48000 * 2)
    clip = samples[start:start + 12000]
    return math.sqrt(sum(float(x) ** 2 for x in clip) / len(clip))
early = rms_at(.10)
late = rms_at(1.72)
assert 0 < late < early * .30, (early, late)
print('GE listener preview: syntax, MP3 frames, filter timing and audible fade checks passed')
