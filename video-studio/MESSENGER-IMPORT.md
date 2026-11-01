# Grand Element Facebook Messenger import

**Source of the GE clip library: conversations in Grand Element's Facebook Page Messenger inbox**, not the Grand Element website's public HTML. The generic site extractor is an optional secondary source only.

## Obtain an authorized export
1. In Facebook, switch to the Grand Element Page (if supported).
2. Open Settings > Accounts Center (or Page download settings) > Your information and permissions > Export your information. Choose the correct Page/profile, **Messages** if offered, **All time**, **JSON**, and export to device.
3. If a Page export does not offer or contain inbox messages, do **not** assume the export includes them. Check the actual archive and use supported Meta Business Suite/Page messaging access or other authorized export mechanisms. Business Page message access and personal Messenger exports can differ. Meta Business Suite > Inbox is the place to review Page conversations.
4. Keep the original ZIP securely. This repository is public; do not upload the ZIP, private correspondence, personal contact information, or the script's extracted CSV/JSON outputs into GitHub.

## Run locally
Python 3.9 or newer:
```sh
python3 ge_messenger_import.py /path/to/facebook-export.zip --output ge-messenger-links.json --csv ge-messenger-links.csv
```
It reads the available `messages/**/message_*.json` records and extracts URLs found in message content or shared attachments, retaining conversation/sender/date in **local-only** metadata. It does not fetch videos, scrape accounts, identify copyright ownership, or decide that a permission was granted.

## Rights handling
The user states he obtained permissions with a tag/credit via Messenger. For bulk extraction, links from a conversation are **candidates** until the appropriate grant is tied to the individual clip. Once the user confirms an individual link, record `user-confirmed Messenger permission`, the proper @handle and agreed limits. Do not assume every URL in a thread is approved, or that tagging provides legal authority by itself.

## For video production
Store each source file by immutable clip ID; video project timelines reference IDs rather than hard-coded media paths. A replacement only changes the chosen clip asset for that timeline slot. Smooth slow motion requires motion-interpolated frames; export bitrate controls compression, not temporal fluidity. Use test segments to catch motion artifacts. Maintain both source frames and rendered versions, plus complete project manifests for future swap and re-render.
