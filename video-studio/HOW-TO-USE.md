# GE Video Studio — Messenger Collector and Video Renderer

## Current implementation (November 2026)

**Installed components (code only, not deployed or tested in an authenticated Meta inbox):**
- `ge-messenger-collector.user.js`: Tampermonkey panel that scans currently rendered Grand Element Messenger conversations and supports loading older messages **in the current conversation**, deduplicates links, saves editable metadata and thumbnail URLs, and exports JSON/CSV.
- `ge_messenger_import.py`: import a Meta JSON message export if one is available for the Grand Element Page.
- `ge_render_video.py`: FFmpeg compositor for local video files and a Grand Element song, with many different crossfade transitions, optional actual transparent GE logo, captioned creator credit, and optical-flow slow motion.
- `clip-vault.json`, `project-template.json`: catalog and project structures.

**Not implemented:** automatic traversal of every Messenger/Page thread; remote platform page-to-file downloader for all sites; authenticated post/comment metadata extraction where not present in a loaded Messenger preview; a beat-perfect editor; audio-reactive circular EQ around the flying GE ship; cloud rendering or live website integration. These require further development.

## Install Tampermonkey collector
1. In Firefox, open Tampermonkey > Create a new script.
2. Copy the full contents of `ge-messenger-collector.user.js`, replacing the new script template; File > Save.
3. Open the Grand Element Facebook Page in Meta Business Suite > Inbox and open a relevant Messenger conversation. Refresh if the GE floating panel is missing.
4. Click **SCAN OPEN CHAT**. **LOAD OLDER + SCAN** attempts to scroll up through that conversation and save additional visible links. It does not jump through every thread.
5. Paste manual links into the direct-link field; edit title, creator tag, date, description and credit when needed.
6. Tick thumbnails to choose clips. **EXPORT JSON**, **CSV**, **DOWNLOAD SELECTED**, and **VIDEO PROJECT** are available.
7. **DOWNLOAD SELECTED** always downloads per-clip metadata sidecars and starts downloads for directly accessible media URLs. Facebook/TikTok/Instagram/etc share *pages* are not necessarily direct video files. Direct media URLs may expire, fail due to hosting rules, or require the actual creator file.

**IMPORTANT PRIVACY:** The Grand Element website GitHub repository is public. Do not commit private Messenger thread content, email addresses, private messages, or downloaded media. JSON exports that contain conversation text should be held locally or in the private GE vault when authenticated storage is built.

## Creator filenames, metadata and credits
Filename uses `YYYY-MM-DD Title @creator [GEV-id].mp4` when a date and creator are known, or `undated`/creator unknown without inventing fields. The full creator caption, description, source URL, message excerpt, length, rights confirmation, dates and credit requirement are stored in per-clip `.metadata.json` sidecars, not crammed into the name. Messenger sharer and original footage creator may be different. Confirm both the creator and copyright authority from the actual post where possible.

Permission status is noted as **user-confirmed via Messenger**; this does not assert independent verification of a contract, every re-use, or sublicensing rights. Retain the original grant privately. If one creator withdraws or limits permission, swap that clip asset and re-render the composition; remember previously published copies may require separate removal or revision.

## Render a music video locally
Install recent FFmpeg (with ffprobe) and Python 3.9+. Download or obtain authorized clip MP4s, ideally source files from their creators. Put them in the same folder as the **GE-Video-Project.json** export and change each selected clip's `local_file` value to its exact MP4 filename.

Then:
```sh
python ge_render_video.py "GE-Video-Project.json" --song "Grand Element Song.wav" --logo "GE-ship.png" --output "GE-Music-Video.mp4" --slow 3 --fps 60 --scene-seconds 18 --transition-seconds 1.4
```

The renderer may repeat selected clips to cover an entire song, estimates strong audio transients as edit points, varies dissolve/slide/wipe/zoom transitions, interpolates 3x slow motion with FFmpeg optical flow, mutes video-source audio and uses only the Grand Element song, and fades the supplied GE logo at the beginning and end. Add `--logo-always` for a centered, smaller logo across the whole track. It exports a `.render-plan.json` with exact sections and source IDs, allowing replacing an individual clip without redesigning the music timeline.

To test faster at 30 fps without expensive optical-flow processing:
```sh
python ge_render_video.py "GE-Video-Project.json" --song "Grand Element Song.wav" --output "GE-preview.mp4" --fps 30 --no-optical-flow
```

**Rendering limitations:** Optical flow generates intermediate images and can still create distortion around fast movement, reflections, geometry and overlapping objects. Check source footage. Bitrate does not solve choppy source motion; frame interpolation and sufficient original source detail are separate matters. The full GE ship fly-through and a truly audio-reactive perimeter EQ are not implemented in this version.

## Full inbox export
If Meta offers **Page Messenger** export in JSON form, use `ge_messenger_import.py` privately to bulk-index messages. Personal profile export and Page inbox export may have different access. The Tampermonkey tool cannot claim to have imported thousands of unloaded messages just because a Page is open.

## Next engineering tasks
- Improve authenticated Page inbox traversal with live DOM inspection of the actual Grand Element Page.
- Add an authorized batch-download worker for agreed platforms/formats and creator-provided source links.
- Add per-frame audio-reactive aura and path-driven transparent GE ship (rotating/flying behind/in front of footage).
- Add video review timeline, stronger beat/onset analysis, and one-button queue for many songs/projects.
- Put source files, permissions, and final exports into a private backed-up vault, not the public GitHub tree.
