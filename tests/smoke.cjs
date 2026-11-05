// GE Studios public-site safety checks. No packages, credentials or network needed.
// Run: node tests/smoke.cjs
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const read=path=>fs.readFileSync(path,'utf8');
const htmlFiles=['index.html','backroom/index.html','radio/ge-dj.html'];
const scripts=[
  'ge-vault-client.js','ge-dream.js','ge-accessibility.js',
  'radio/website-live.js','radio/ge-home-gate-stop.js',
  'radio/ge-imac-studio.js','radio/ge-vault-drilldown.js','sw.js'
];
let checked=0;
for(const path of [...scripts]){
  new vm.Script(read(path),{filename:path});
  checked++;
}
for(const path of htmlFiles){
  const html=read(path);
  const regex=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while((match=regex.exec(html))){
    const attrs=match[1],js=match[2];
    if(!js.trim()||/\btype\s*=\s*["'](?:application\/(?:ld\+json|json)|importmap)["']/i.test(attrs))continue;
    new vm.Script(js,{filename:path+':inline'});
    checked++;
  }
}
const backroom=read('backroom/index.html');
const home=read('index.html');
const vault=read('ge-vault-client.js');
const dj=read('radio/ge-dj.html');
const published=JSON.parse(read('config/site-live.json'));
const manifest=JSON.parse(read('radio/manifest.json'));
const approved=published?.music?.radioMasterSongPaths;
assert.equal(published.mode,'live','Public configuration must remain live');
assert(Array.isArray(manifest.files)&&manifest.files.length>0,'Music manifest must be present');
assert(Array.isArray(approved)&&approved.length>0,'Published Radio Master cannot be empty');
assert.equal(new Set(approved).size,approved.length,'Radio Master duplicates found');
for(const path of approved)assert(manifest.files.includes(path),'Radio Master song missing: '+path);
assert(backroom.includes('id="gateLocal"'),'Cloudflare-independent Back Room entry missing');
assert(backroom.includes('id="publishLive" type="button">PUBLISH GITHUB'),'GitHub publishing is not primary');
assert(backroom.includes('id="legacyPublishLive"'),'Legacy publisher fallback missing');
assert(backroom.includes("const GE_GITHUB_PUBLIC_FIELDS="),'Public-field whitelist missing');
const whitelist=backroom.match(/const GE_GITHUB_PUBLIC_FIELDS=(\[[^\]]+\])/);
assert(whitelist&&!/['"](?:music|vault|accessCodes|fanRecords)['"]/.test(whitelist[1]),'Unsafe public publisher whitelist');
assert(backroom.includes("radioMasterSongPaths:selected"),'Radio Master GitHub save missing');
assert(backroom.includes('publisherBase=await repoLive()'),'Published-base conflict guard missing');
assert(!backroom.includes('void restorePublisherSession().then'),'Opening public Back Room must not call Cloudflare automatically');
assert(backroom.includes('if(await restorePublisherSession())return'),'Private session resume must remain available on demand');
assert(!backroom.includes('async async function'),'Duplicate async regression detected');
assert(backroom.includes('GE_BACKROOM_PUBLIC_CONFIG_CACHE_V1'),'Published config fallback missing');
assert(backroom.includes("if(serverAuthenticated)backroomVaultManagers.init()"),'Private Vault must not auto-initialize for local editor');
assert(home.includes('ge-merch-random-scheduler'),'Merchandise random scheduler missing');
assert(home.includes('45000+Math.random()*30000'),'Merchandise spacing must be 45–75 seconds');
assert(home.includes('--ge-merch-factor:.5625'),'Reduced hat size missing');
assert(home.includes('ge-merch-flying'),'Merchandise flyby animation hook missing');
assert(!home.includes('.workers.dev'),'Public homepage must not require a Cloudflare Worker URL');
assert(vault.includes('GE_EVENT_BATCH_SIZE=25'),'Vault event batching missing');
assert(vault.includes('geEventCooldownUntil'),'Vault outage circuit breaker missing');
assert(dj.includes('ge-radio-sync.grandelement.workers.dev'),'DJ backend is still required; do not silently remove its bridge');
assert(dj.includes('geBoardMeterPauseUntil'),'DJ meter outage backoff missing');
assert(dj.includes('meterActive?850:5000'),'DJ active/idle network pacing missing');
assert(!dj.includes('setInterval(pushBoardFastMeter,120)'),'DJ remote meter still polls 8+ times each second');
assert(vault.includes("SCORE_RETRY_AFTER_KEY"),'Vault score outage cooldown missing');
assert(vault.includes('pending.slice(0,10)'),'Legacy scores must migrate in bounded batches');
assert(!vault.includes('local.slice(0,100)'),'Legacy score 100-request burst has returned');
assert(home.includes('20261105-score-backoff-v2'),'Website must load latest Vault client');

console.log('PASS:',checked,'JavaScript scripts parsed;',approved.length,'Radio Master tracks verified; GitHub public publisher and Vault protections checked.');
