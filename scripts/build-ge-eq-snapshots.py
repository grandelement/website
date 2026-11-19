#!/usr/bin/env python3
"""Build measured Sun Lab frequency snapshots from recorded GE music. Audio is never modified."""
import argparse
import json
import subprocess
from pathlib import Path
import numpy as np

RATE = 16000
FFT = 512
BANDS = 16
STEP_LIMIT = 1800
ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'ge-music' / 'music'
DEST = ROOT / 'radio' / 'eq-snapshots'
EXTENSIONS = {'.mp3', '.wav', '.m4a', '.ogg'}


def snapshot_name(relative):
    # The browser hashes decodeURIComponent(URL.pathname), not the percent-escaped URL.
    h = 2166136261
    for byte in ('/' + relative.as_posix()).encode('utf-8'):
        h = ((h ^ byte) * 16777619) & 0xffffffff
    return f'{h:08x}.json'


def profile(source):
    process = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(source),
         '-ac', '1', '-ar', str(RATE), '-f', 'f32le', 'pipe:1'],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
    )
    signal = np.frombuffer(process.stdout, dtype='<f4')
    duration = len(signal) / RATE
    if not (0 < duration <= 900):
        raise ValueError('Unsupported duration: ' + str(duration))
    hop = max(0.2, duration / STEP_LIMIT)
    centers = np.arange(0, duration, hop, dtype=np.float64)[:STEP_LIMIT]
    frequencies = np.fft.rfftfreq(FFT, 1/RATE)
    band_indices = []
    for band in range(BANDS):
        low = 55 * (7800/55) ** (band/BANDS)
        high = 55 * (7800/55) ** ((band+1)/BANDS)
        indexes = np.flatnonzero((frequencies >= low) & (frequencies < high))
        if len(indexes) == 0:
            indexes = np.array([int(np.argmin(abs(frequencies - (low+high)/2)))])
        band_indices.append(indexes)
    hann = np.hanning(FFT).astype(np.float32)
    offsets = np.arange(FFT, dtype=np.int64) - FFT//2
    powers = np.zeros((len(centers), BANDS), dtype=np.float32)
    for start in range(0, len(centers), 160):
        stop = min(len(centers), start+160)
        mid = (centers[start:stop] * RATE).astype(np.int64)
        indexes = np.clip(mid[:, None] + offsets[None, :], 0, len(signal)-1)
        transforms = np.abs(np.fft.rfft(signal[indexes] * hann[None, :], axis=1))
        for band, bins in enumerate(band_indices):
            powers[start:stop, band] = np.sqrt(np.mean(transforms[:, bins]**2, axis=1))
    peaks = powers.max(axis=0)
    scaled = np.divide(powers, peaks[None, :], out=np.zeros_like(powers), where=peaks[None, :] > 1e-6)
    scaled = np.where(scaled >= .012, scaled**.7, 0)
    return {'duration': round(duration, 4), 'hop': round(hop, 8),
            'frames': np.rint(np.clip(scaled, 0, 1)*255).astype(np.uint8).tolist()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--check', action='store_true', help='Decode and validate without writing')
    args = parser.parse_args()
    sources = sorted(path for path in AUDIO.rglob('*') if path.suffix.lower() in EXTENSIONS)
    if args.limit:
        sources = sources[:args.limit]
    if not sources:
        raise SystemExit('No music recordings found')
    for i, path in enumerate(sources, 1):
        relative = path.relative_to(ROOT)
        try:
            data = profile(path)
            if not data['frames'] or not any(any(x > 0 for x in row) for row in data['frames']):
                raise ValueError('Empty spectrum')
            if not args.check:
                DEST.mkdir(parents=True, exist_ok=True)
                (DEST / snapshot_name(relative)).write_text(json.dumps(data, separators=(',', ':')) + '\n')
            print(f'OK {i}/{len(sources)}: {relative} ({len(data["frames"])} frames)')
        except (subprocess.CalledProcessError, ValueError) as error:
            raise SystemExit(f'FFT failed for {relative}: {error}') from error
    print(f'Validated {len(sources)} authentic song profiles')


if __name__ == '__main__':
    main()
