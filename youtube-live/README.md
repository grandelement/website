# Grand Element YouTube Live shell

This is a separate 24/7 video encoder for YouTube. It does not run the GE Radio backend.

## What it does

1. Starts a private 1920x1080 virtual display.
2. Opens the live GE broadcast page in Chromium.
3. Captures that display at 30 fps.
4. Pulls the existing GE Radio MP3 stream directly for reliable audio.
5. Sends video + audio to YouTube over RTMPS.

The browser opens the GE Live page with `?mute=1`. The page still analyzes the station audio for the pulsing GE logo/EQ, but FFmpeg pulls the radio stream separately so YouTube receives one clean audio feed.

## Required secret

Set:

`YOUTUBE_STREAM_KEY`

Never commit the stream key to GitHub.

## Optional environment variables

- `GE_LIVE_URL` defaults to `https://www.grandelement.com/live/?mute=1`
- `GE_RADIO_STREAM` defaults to `https://radio.grandelement.blitz.cloud/stream.mp3`
- `YOUTUBE_INGEST` defaults to `rtmps://a.rtmps.youtube.com/live2`
- `VIDEO_BITRATE` defaults to `6000k`
- `VIDEO_MAXRATE` defaults to `6500k`
- `VIDEO_BUFSIZE` defaults to `12000k`
- `AUDIO_BITRATE` defaults to `128k`

## Local Docker test

Build:

`docker build -f Dockerfile.youtube-live -t ge-youtube-live .`

Run with an unlisted/test YouTube stream key:

`docker run --rm -e YOUTUBE_STREAM_KEY=YOUR_KEY ge-youtube-live`

For production, deploy this Dockerfile as its own always-on service and store the YouTube key in the host's secret/environment-variable manager.
