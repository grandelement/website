# GE Remote Mic — iOS MVP

This is the native iPhone/iPad remote microphone companion for the GE DJ booth.

## What this first version does

- Pairs to the DJ backend using a one-time six-digit code.
- Stores the device credential in Keychain.
- REMOTE READY starts an AVAudioSession + AVAudioEngine input session.
- The audio background mode allows an already-started recording session to continue when the app backgrounds or the screen locks, subject to iOS audio-session rules.
- Sends heartbeat, readiness and microphone meter information to the DJ backend.
- Receives AIR / MUTE / LEVEL / STOP commands from the DJ backend.
- When AIR is requested, gets a one-use live token and sends 48 kHz stereo Int16 PCM to the existing GE /control/live WebSocket.

## Important iOS boundary

REMOTE READY must already be enabled. iOS does not allow an ordinary server command to silently start microphone recording from a force-quit/inactive app. The app intentionally shows its recording state and uses normal system microphone permission.

## Build

This folder uses XcodeGen:

1. Install XcodeGen on the Mac.
2. From ios/GERemoteMic run: xcodegen generate
3. Open GERemoteMic.xcodeproj.
4. Choose your Apple Development team.
5. Build to the iPhone/iPad.
6. In Signing & Capabilities verify Background Modes → Audio is enabled.

## Current media limitation

The existing GE server live bridge has one contribution owner. This MVP supports a remote phone as that live source. Simultaneous independent iPhone + iPad + local DJ mic mixing requires the planned multi-input server mixer; pairing/presence/control is already structured so each device can become its own channel when that mixer is added.
