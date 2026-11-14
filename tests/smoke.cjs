// GE Studios public-site safety checks. No packages, credentials or network needed.
// Run: node tests/smoke.cjs
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const read=path=>fs.readFileSync(path,'utf8');
const htmlFiles=['index.html','backroom/index.html','radio/index.html','radio/ge-dj.html'];
const scripts=[
  'ge-vault-client.js','ge-dream.js','ge-accessibility.js',
  'radio/website-live.js','radio/ge-home-gate-stop.js',
  'radio/ge-imac-studio.js','radio/ge-vault-drilldown.js','sw.js','radio/sw.js'
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
const radio=read('radio/index.html');
const siteSW=read('sw.js');
const radioSW=read('radio/sw.js');
const continuity=JSON.parse(read('operations/service-register.json'));
const published=JSON.parse(read('config/site-live.json'));
const manifest=JSON.parse(read('radio/manifest.json'));
const approved=published?.music?.radioMasterSongPaths;
assert.equal(published.mode,'live','Public configuration must remain live');
assert(Array.isArray(manifest.files)&&manifest.files.length>0,'Music manifest must be present');
assert(Array.isArray(approved)&&approved.length>0,'Published Radio Master cannot be empty');
assert.equal(new Set(approved).size,approved.length,'Radio Master duplicates found');
for(const path of approved)assert(manifest.files.includes(path),'Radio Master song missing: '+path);
assert(!backroom.includes('id="gateLocal"'),'PUBLIC BACK ROOM BYPASS MUST NOT EXIST');
assert(!backroom.includes('openLocalEditor'),'Local editor bypass must be removed');
assert(backroom.includes('id="gatePassword"'),'Owner password gate missing');
assert(backroom.includes('id="gateEnter"'),'Owner sign-in missing');
assert(backroom.includes('id="publishLive" type="button">PUBLISH GITHUB'),'GitHub publishing is not primary');
assert(backroom.includes('id="legacyPublishLive"'),'Legacy publisher fallback missing');
assert(backroom.includes("const GE_GITHUB_PUBLIC_FIELDS="),'Public-field whitelist missing');
const whitelist=backroom.match(/const GE_GITHUB_PUBLIC_FIELDS=(\[[^\]]+\])/);
assert(whitelist&&!/['"](?:music|vault|accessCodes|fanRecords)['"]/.test(whitelist[1]),'Unsafe public publisher whitelist');
assert(backroom.includes("action:'save_master',masterSongPaths:selected") &&
       backroom.includes("expectedMasterSongPaths:brMasterSavedPaths") &&
       backroom.includes("brMasterSavedPaths=selected.slice()"),
       'Radio Master authenticated save or concurrency guard missing');
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
assert(dj.includes('document.hidden?30000:(meterActive?12000:30000)'),'DJ active/idle network pacing missing');
assert(!dj.includes('setInterval(pushBoardFastMeter,120)'),'DJ remote meter still polls 8+ times each second');
assert(vault.includes("SCORE_RETRY_AFTER_KEY"),'Vault score outage cooldown missing');
assert(vault.includes('pending.slice(0,10)'),'Legacy scores must migrate in bounded batches');
assert(!vault.includes('local.slice(0,100)'),'Legacy score 100-request burst has returned');
assert(home.includes('ge-vault-client.js?v=20261112-emergency-fan-tracking-v4'),'Website must load approved Vault client');
assert(vault.includes('GE_EVENT_COOLDOWN_KEY'),'Vault retry backoff must persist across page reloads');
assert(siteSW.includes('GE_SITE_SHELL_V7_STANDALONE_MUSIC_20261109'),'Current website shell cache key missing');
for(const file of ['ge-vault-client.js','config/site-live.json','radio/manifest.json','radio/ge-home-gate-stop.js','ge-dream.js'])
  assert(siteSW.includes('./'+file),'Public offline core asset missing: '+file);
assert(siteSW.includes("relative.startsWith('backroom/')"),'Owner Back Room must not be served from public offline cache');
assert(siteSW.includes('response.status>=500'),'Hosting outage cache fallback missing');
assert(radio.includes('GE_RADIO_AUTO_CATALOG_CHECK_V1'),'Radio must throttle optional external GitHub catalog API');
assert(radio.includes('Date.now()-lastChecked<6*60*60*1000'),'Radio catalog API throttle changed');
assert(radio.includes('loadMusicManifest('),'Radio must retain static music manifest fallback');
assert(radioSW.includes('const MEDIA_CACHE='),'Downloaded radio media preservation missing');
assert(continuity.schemaVersion===1&&continuity.designRules.baseWebsiteRequiresBackend===false,
  'Ten-year continuity service register schema invalid');
assert(continuity.designRules.neverChangeBankingOrAutopayWithoutExplicitOwnerAuthorization===true,
  'Automated banking must require explicit authorization');
assert(Array.isArray(continuity.serviceRegister)&&continuity.serviceRegister.length>=10,
  'Continuity service dependency inventory missing');
assert(!JSON.stringify(continuity).includes('secret_key'),'Continuity file must not contain secrets');


console.log('PASS:',checked,'JavaScript scripts parsed;',approved.length,'Radio Master tracks verified; offline fallback, owner protection and service continuity checked.');
