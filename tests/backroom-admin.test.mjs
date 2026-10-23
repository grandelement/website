import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';

const read=path=>readFileSync(path,'utf8');
const back=read('backroom/index.html');
const publisher=read('backroom/publisher-worker.js');
const vault=read('vault-worker/src/index.js');
const schema=read('vault-worker/schema.sql');
const migration=read('vault-worker/migrations/20261021_access_codes.sql');

for(const [name,source] of [['publisher',publisher],['vault',vault]]){
  new Script(source.replace('export default {','const __testExport = {'),{filename:name+'.js'});
}
const inlineScripts=[...back.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.ok(inlineScripts.length>=1,'Back Room must have an inline script');
for(const [i,s]of inlineScripts.entries()){
  if(/src=|application\/json/.test(s[1]))continue;
  new Script(s[2],{filename:'backroom-inline-'+i+'.js'});
}
const tabs=['welcome','about','universe','games','radio','access','gate','scores','presets'];
for(const tab of tabs){
  assert.ok(back.includes('data-tab="'+tab+'"'),'Missing tab: '+tab);
  assert.ok(back.includes('data-br-tab="'+tab+'"'),'Missing section: '+tab);
}
assert.ok(!back.includes('data-tab="playlists"'),'Playlists should be inside RADIO, not a separate navigation tab');
assert.ok(back.includes('data-br-tab="playlists"'),'Radio playlists editor section must exist');
assert.ok(!back.includes('QUICK ACCESS'),'Redundant Quick Access panel must remain removed');
assert.ok(!back.includes('id="brTabHome"'),'Empty HOME tab must remain removed');
assert.ok(back.includes('grid-template-columns:repeat(20,minmax(0,1fr))!important'),
  'Back Room category buttons must appear in a 20-column two-row grid');
const spans=[...back.matchAll(/\.backroomTabs button:nth-child\((\d+)\)\{grid-column:span (\d+)\}/g)]
  .map(match=>[Number(match[1]),Number(match[2])]);
assert.equal(spans.length,9,'Nine tab buttons need explicit row spans');
assert.equal(spans.slice(0,5).reduce((sum,[,n])=>sum+n,0),20,'First row fits exactly five tabs');
assert.equal(spans.slice(5).reduce((sum,[,n])=>sum+n,0),20,'Second row fits remaining four tabs');
assert.ok(!back.includes('Swipe the tabs sideways'),'No sideways-scrolling directions should remain');
assert.ok(!back.includes('Make changes here. SAVE keeps your working copy'),'Redundant intro must be removed');
assert.ok(!back.includes('<summary>SETTINGS</summary>'),'Settings must not consume its own text row');
assert.match(back,/aria-label="Back Room settings" title="Back Room settings"/);
assert.match(back,/if\(category==='gate'\|\|category==='welcome'\|\|category==='about'\|\|category==='access'\|\|category==='playlists'\)\s*\{\s*heading\.remove\(\)/);
assert.ok(back.includes("category==='access'||category==='playlists'"),'Access Codes and Radio Playlists should open without a second accordion click');
assert.ok(back.includes('const setStatus=t=>'),'Save and Publish feedback must remain wired');
assert.ok(back.includes("if(initial==='home'||initial==='content')initial='welcome'"),'Old saved HOME and CONTENT tabs must migrate to WELCOME');
assert.ok(back.includes("const categories=['welcome','about','universe'"),'WELCOME and ABOUT should replace CONTENT');
assert.ok(back.includes("#backroomMain .topControls button.publish{"),'Main Back Room buttons have independent readable typography');
assert.ok(back.includes("font-size:clamp(15px,calc(17px * var(--scale)),18px)"),'Main action text is enlarged from tiny mobile setting');
for(const id of ['viewWebsite','save','publishLive']){
  assert.ok(back.includes('id="'+id+'"'),'Keep primary Back Room action '+id);
}
for(const id of ['brPlaylistSave','brPlaylistDelete','brPlaylistSearch','brPlaylistTracks',
  'brAccessIssue','brAccessMaster','brAccessList','brAccessMode','brAccessMaxUses',
  'brAccessBrowse','brAccessEditor','brAccessSelect','brAccessPrev','brAccessNext',
  'brAccessPlaylist','brAccessSongSearch','brAccessSongChecklist','brAccessSelectAll','brAccessClearSongs','brAccessSongs','brAccessSave',
  'brAccessEdit','brAccessDelete','brAccessCancel','brAccessNew',
  'brAccessCopy','save','publishLive','reset','lockBackroom']){
  assert.ok(back.includes('id="'+id+'"'),'Missing Back Room control: '+id);
}
assert.match(back,/backroomVaultManagers\.init\(\)/);
assert.ok(back.includes("if(name!=='access')toggle?.click()"),'Access manager should be visible immediately without an extra accordion click');
assert.match(back,/function renderAccessCodes/);
assert.match(back,/function showCodeEditor/);
assert.match(back,/function assignedSongsUI/);
assert.match(back,/action:isEdit\?'edit':'issue'/);
assert.match(back,/\/manage\/access-codes/);
assert.match(vault,/accessAssignments/);
assert.match(vault,/action==="edit"/);
assert.match(vault,/action==="delete"/);
assert.match(vault,/access_code_deletions/);
assert.match(publisher,/\['issue','edit','activate','suspend','revoke','delete','master'\]/);
assert.match(schema,/CREATE TABLE IF NOT EXISTS access_code_content/);
assert.match(schema,/CREATE TABLE IF NOT EXISTS access_code_deletions/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS access_code_content/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS access_code_deletions/);
assert.match(back,/\/manage\/access-codes/);
assert.match(back,/\/manage\/playlists/);
assert.match(publisher,/verifySession\(env,bearer\(request\)\)/);
assert.match(publisher,/VAULT_ADMIN_TOKEN/);
assert.match(vault,/GE_ACCESS_SCOPES/);
assert.match(vault,/accessCodeHash/);
assert.match(vault,/accessRedeem/);
assert.match(vault,/accessAdminChange/);
assert.match(vault,/VAULT_HASH_KEY/);
assert.match(schema,/CREATE TABLE IF NOT EXISTS access_codes/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS access_codes/);
assert.ok(!/GE_BACKROOM_CODE\s*=/.test(back),'Do not embed access code in front-end');
assert.ok(back.includes("document.querySelectorAll('#backroomTabPanels input,#backroomTabPanels textarea,#backroomTabPanels select')"),'All mounted settings must mark unsaved changes');
assert.ok(back.includes("event.target.closest('button,input,select,textarea,label')"),'Playlist dragging must not swallow checkbox taps');
assert.ok(back.includes("const openSetup=button=>"),'Game OPTIONS should open setup in one tap');
for(const game of ['points','pockets','planets','golf','gravity','body','flight']){
  assert.ok(back.includes("gamePoints:'points'") && back.includes("gameFlight:'flight'"),'All game OPTIONS links need explicit mapping');
}
assert.ok(back.includes("const box=$('editorOpacityControls');box.hidden=false;"),'Welcome and About transparency sliders must be visible in WEBSITE VIEW');
assert.ok(back.includes("doc.getElementById('about')?.classList.add('show')"),'About opacity preview must open the affected website panel');
assert.ok(back.includes("doc.getElementById('geWelcome')?.classList.add('show')"),'Welcome opacity preview must open the affected website panel');
assert.ok(back.includes('id="brRadio2Check"')&&back.includes('id="brRadio2Status"'),
  'Owner needs a live read-only Radio 2 Bangers status check');
assert.ok(back.includes("program?.playlist_name||''")&&back.includes("checkRadio2Bangers()"),
  'Do not call an unrelated playlist a confirmed Bangers broadcast');
assert.ok(back.includes('id="brImportBangers"'),'Radio needs an import control for the DJ Bangers backup');
assert.ok(back.includes("localStorage.getItem('geRadioPlaylistBackup')"),'Bangers import must read the authentic GE DJ browser backup');
assert.ok(back.includes("bangers.paths||[]"),'Bangers import must preserve real selected tracks');
assert.ok(back.includes('DJ BANGERS LOADED FROM THIS DEVICE'),'Bangers import should distinguish saved DJ data from live BLITZ status');
assert.ok(back.includes('href="../radio/ge-dj.html"'),'DJ Booth should open on the same website origin for backup access');
console.log('PASS Back Room code management, selectable Bangers playlist, direct game setup, draft change tracking and syntax');
