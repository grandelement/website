import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// A second browser-side GitHub publisher previously required its own
// per-device expiring PAT. That route is retired, while public website
// settings still use the authenticated Cloudflare Publisher.
const oldEntry=readFileSync('backroom/github-direct.html','utf8');
const back=readFileSync('backroom/index.html','utf8');
const worker=readFileSync('backroom/publisher-worker.js','utf8');
const center=readFileSync('backroom/save-center.js','utf8');
assert.match(oldEntry,/http-equiv="refresh" content="0;url=\.\/"/,
 'Old publisher bookmark must direct owners back to canonical Back Room.');
assert.doesNotMatch(oldEntry,/github-direct\.js|github_pat_|id="setupToken"|id="unlockCode"/,
 'Retired page must never ask for or load a device-local GitHub personal access token.');
assert.doesNotMatch(back,/brGithubToken|geGithubCommit\(|publishGithub\(|legacyPublishLive|GE_GITHUB_CONFIG_API/,
 'Back Room must not load legacy direct PAT publishing code.');
assert.doesNotMatch(back,/<script[^>]+github-bridge\.js/,
 'Back Room must not load the obsolete direct-PAT iframe bridge.');
assert.match(back,/GE_BACKROOM_SAVE_PUBLIC_SETTINGS=async function\(/,
 'Scoped authenticated website settings publisher must remain.');
assert.match(center,/GE_BACKROOM_SAVE_PUBLIC_SETTINGS/,
 'Visible Back Room SAVE must still call the authenticated publisher.');
assert.match(worker,/async function githubCredential\(env\)/);
assert.match(worker,/GITHUB_APP_PRIVATE_KEY/,
 'Server-side renewable GitHub App authorization must remain supported.');
console.log('PASS: retired expired-PAT direct publisher and preserved server-side scoped GitHub SAVE.');
