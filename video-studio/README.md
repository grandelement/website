# GE Video Studio

Grand Element / GE Studios music-video production library.

## Goal
Paste share links, retain source and creator information, track permission, assemble short clips (often ~10 seconds) against a Grand Element song, fly the actual GE spaceship logo through footage with an audio-reactive aura, and fade the GE identity in near the ending.

This directory is **not a deployed app or an active downloader/rendering service**. It is the durable source-of-truth setup for the planned feature. Adding files here does not alter the live website.

## Workflow
1. Collect links in `clip-vault.json`. Keep original URL and creator/handle. Identity and ownership inferred from a share link must be verified.
2. By the owner's instruction, a link supplied to GE Video Studio is accompanied by the owner's confirmation that the creator gave permission via Messenger, conditioned on credit/tagging. Mark it `user_confirmed_via_messenger` and retain the attestation. Do not demand a repeated confirmation for each link. If a stated restriction or rights conflict arises, flag it rather than assuming broader permission.
3. Only acquire/download clips through methods permitted by the hosting platform and the rights holder. A share link or creator credit alone does not authorize copying, remixing or publication.
4. For each video project, choose a Grand Element audio file, approved/otherwise legally usable video files, and the actual transparent GE ship/logo asset.
5. Render a private draft, review sync/sequence/credits, then render and release only assets cleared for that use.
6. Store creator handle, source post, preferred credit, permission basis (`user_confirmed_via_messenger`), and any extra restrictions. Optional proof remains in private storage, not the public repo. If the source cannot identify the creator confidently, flag `credit_needs_verification` without inventing a handle.

## Default edit profile
- Visuals: abstract particles, patterns, kaleidoscopes, flowing energy, quantum/geometry imagery.
- Short clips: 10 seconds nominal, adjustable; changes and transitions follow music.
- GE ship: intermittently passes through frame in front of footage, small enough not to hide the scene.
- Halo: reactive to track intensity rather than a purely random light.
- Ending: official Grand Element logo fades in over the final seconds.
- Creator: accurate on-screen tag/handle when requested by the source or agreed with artist; optional end credits as appropriate.
- Outputs: 16:9 full-screen and optional 9:16 social version, with separate approved final and private draft files.

## Video rights
Record the license/approval for creating an audiovisual derivative synchronized with music; rights to publish and promote across the GE site and social channels; territories, duration, whether commercial use is allowed, credit terms, and any restrictions. Do not confuse permission from the uploader with rights held by the actual copyright holder. Use `permission_status: user_confirmed_via_messenger` for submitted links, rather than falsely marking an independently verified license. Any additional terms or withdrawal request should be recorded. Refusals must be honored.

## Next implementation step
Create an authenticated Back Room page on grandelement.com with a paste-links inbox connected to the existing private GE Vault. Then connect a render service (such as FFmpeg running on a properly provisioned worker/computer) that can access approved media and audio files. Cloudflare front-end/Workers alone is not a general full-track FFmpeg rendering machine. The UI and cloud-rendering service remain to be implemented and tested.

## Permission message
See `permission-request.md`. Keep the exact grant and its evidence in the project ledger.

## Standing instruction (2026-11-01)
- The owner has already messaged creators and says links delivered to us mean the footage may be used in GE music videos provided the creator is tagged/credited.
- On intake, default to the owner's permission confirmation without re-asking. Keep the distinction between an owner-reported permission and a direct copy of the grant.
- Maintain precise on-screen creator credit plus source link/credit in the end card or caption as relevant. Do not guess the copyright owner or assign a copyright transfer to GE Studios.
- Source links are not guaranteed downloadable. Download/import only from authorized supported methods and keep missing-media items in the catalog.
