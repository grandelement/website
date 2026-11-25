# Grand Element site control map

**Purpose:** one owner, one canonical source for each kind of data. Read this before editing Back Room, Radio, Music, Access Codes or deployment workflows. This is an implementation map, not evidence that live services passed authenticated tests.

| Surface or setting | Canonical source | Read location | Authorized write |
| --- | --- | --- | --- |
| Website content and FRONT / STORE / PLAYER / RADIO routing | `config/site-live.json` | Website, Radio, Music, Store | Back Room publisher `/manage/player-profile` or website publish |
| Physical music catalog | `radio/manifest.json` | Music and Back Room catalog selector | Existing manifest-publish workflow |
| Shared DJ / public and unlisted playlists | `playlists/registry.json` | Music, Radio, Back Room | Back Room `/manage/github-playlists`, GitHub commit |
| Private Access Codes and permissions | GE Vault D1 `access_codes`, `access_code_content` | Back Room via `/manage/access-codes` | Scoped Publisher → Vault Worker bridge |
| Saved fan profiles and access-code assignment | GE Vault D1 `fans`, `fan_code_links` | Back Room FANS | Scoped Publisher → Vault `/v1/admin/fan-access` |
| Live BLITZ stream / backup Radio program | Existing Radio 1 stream and Radio 2 Worker | `radio/index.html` | Separate DJ/backend publisher, **not** GitHub playlists |
| Public EQ Effects availability | `config/site-live.json` `music.publicPlayer.scopes` contains `sunlab` | `radio/index.html` | Website public profile publisher |
| Advanced Sun Lab tuning permission | GE Vault saved code with `sunlab` scope | Verified Radio grant receipt | Access Codes editor, scoped Vault |
| Each user's chosen EQ mode/preset settings | Per-device browser storage | Radio Sun Lab | Local SAVE; SEND EQ TO PHONE transfers explicitly |

## Front end responsibilities

`index.html` is the website landing page, `radio/index.html` is the active Radio/Player, `backroom/index.html` is the owner workbench, `support/index.html` is the Store, and `vault/index.html` is not a replacement source for Back Room Access Codes. Older/preview DJ, Radio and support pages are separate experiments and should not become default routes without an intentional change.

**Do not introduce** a second playlist master, copy private codes into GitHub, rely on a browser-only draft as proof of publication, or let an Access Code checkbox change global public EQ availability. Distinguish local EQ preset saves from GitHub public profile saves.

## Prevention and verification

`tests/ge-site-control-integrity.test.mjs` checks primary-page duplicate IDs and broken local assets, exact music path consistency, public-versus-private EQ control boundaries, and the Access Code Expiration/Fans boundary. The dedicated `GE Site Control Integrity` workflow reruns it on related changes.

Separate GitHub CI workflows exercise Back Room, Vault, Radio and browser layouts. A green static test or successful deployment is **not** proof of end-to-end authentication, real GitHub write and readback, mobile audio playback, or an owner-issued Access Code. Validate those independently; keep the prior working deployment available for rollback.
