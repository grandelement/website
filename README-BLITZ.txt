GE Radio v5.0 CLOUD SAFE

This build is deliberately tuned for the current blitz.cloud Docker rules.

PLATFORM FIT
- linux/amd64 Debian base
- runtime user/group 1000; no root or Linux capabilities required
- only public listener is nginx on 0.0.0.0:8080
- Icecast 8000, DJ API 8090, Liquidsoap control 1234 stay localhost-only
- Docker app remains a small Blitz app; the current published ceiling is 512 MB RAM and 0.5 CPU
- one kept folder only: /app/data; Blitz currently reserves 1 GB storage for an app with kept folders
- DJ_PASSWORD remains an environment variable
- GitHub-source deployment still requires the repository to be public

STABILITY CHANGES
- public nginx gateway starts before the music library fetch, so a temporary GitHub problem does not keep the whole app from becoming reachable
- internal services are supervised and restarted inside the container because Blitz does not auto-restart custom Docker apps
- saved station settings and custom mixes moved to /app/data instead of disposable /app/runtime
- Live DJ loader adds one local track at a time instead of handing Safari a whole crate at once
- local audio is attached lazily only when the user presses Play/Arm
- deprecated main-thread ScriptProcessor audio bridge replaced with AudioWorklet
- Live DJ code split into HTML, CSS, JS, and worklet files
- old heavy Debian/package layers are intentionally kept in the same order as v4.x so Blitz can reuse its build cache
- no giant base64 lines in Dockerfile

BLITZ SETTINGS
Dockerfile: Dockerfile.radio
Port: 8080
Background worker: OFF
Start command: blank
Environment: DJ_PASSWORD=<your private password>

Do not expose 8000, 8090, 1234, or 5555 publicly.
