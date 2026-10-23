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
const tabs=['welcome','about','universe','games','radio','playlists','access','moon','gate','scores','presets'];
const dj=read('radio/ge-dj.html');
const radio=read('radio/index.html');
const sw=read('radio/sw.js');
for(const tab of tabs){
  assert.ok(back.includes('data-tab="'+tab+'"'),'Missing tab: '+tab);
  assert.ok(back.includes('data-br-tab="'+tab+'"'),'Missing section: '+tab);
}
assert.ok(back.includes('data-tab="playlists"'),'Original DJ playlists need a dedicated tab next to RADIO');
assert.ok(back.includes('data-tab="moon"'),'Radio Moon must have its own tab');
assert.ok(back.includes('grid-template-columns:repeat(28,minmax(0,1fr))!important'),
  'Four tabs in first row and seven in second row should fit without scrolling');
assert.ok(back.includes('button:nth-child(-n+4){grid-column:span 7!important}'), 'Four first-row tabs');
assert.ok(back.includes('button:nth-child(n+5){grid-column:span 4!important}'), 'Seven second-row tabs');
assert.ok(back.includes('button[data-tab="radio"][aria-selected="true"]'), 'RADIO highlights when active');
assert.ok(!back.includes('Swipe the tabs sideways'),'No sideways-scrolling directions should remain');
assert.ok(!back.includes('Make changes here. SAVE keeps your working copy'),'Redundant intro must be removed');
assert.ok(!back.includes('<summary>SETTINGS</summary>'),'Settings must not consume its own text row');
assert.match(back,/aria-label="Back Room settings" title="Back Room settings"/);
assert.match(back,/if\(category==='gate'\|\|category==='welcome'\|\|category==='about'\|\|category==='access'\|\|category==='playlists'\|\|category==='moon'\)\s*\{\s*heading\.remove\(\)/);
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
assert.ok(back.includes("if(name!=='access'&&name!=='games')toggle?.click()"),'Game sections should use the + expansion while Access Code input is directly visible');
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
assert.doesNotMatch(back,/\/manage\/playlists/, 'Do not load a second playlist manager for Access Codes');
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
assert.ok(!back.includes('class="brGameOptionsButton"'),
  'Back Room contains only expandable general defaults, not each game setup control');
assert.ok(back.includes('id="brGameGeneralDefaults"')&&
  back.includes("if(name!=='access'&&name!=='games')toggle?.click()"),
  'Game Defaults and Games Available expand using the standard section plus controls');
assert.ok(back.includes("const box=$('editorOpacityControls');box.hidden=false;"),'Welcome and About transparency sliders must be visible in WEBSITE VIEW');
assert.ok(back.includes("doc.getElementById('about')?.classList.add('show')"),'About opacity preview must open the affected website panel');
assert.ok(back.includes("doc.getElementById('geWelcome')?.classList.add('show')"),'Welcome opacity preview must open the affected website panel');
assert.ok(!back.includes('id="brRadio2Check"'),'Remove confusing Radio 2 Bangers check control');
assert.ok(back.includes('id="brDJPlaylistEditor"')&&back.includes('id="brDJPassword"'),
  'Back Room should show original DJ playlist controls without changing the DJ Booth');
assert.ok(!back.includes('id="brDJPlaylistFrame"')&&
  !dj.includes('const GE_DJ_PLAYLIST_ONLY='),
  'Do not modify or embed the original working DJ Booth');
assert.ok(back.includes("geDJApi('/control/playlists')")&&
  back.includes("geDJApi('/control/library')")&&
  back.includes('geDJVaultConfirmed'),
  'Back Room must read authenticated original DJ records and track Vault synchronization');
assert.ok(back.includes('<section data-br-tab="playlists" id="brDJPlaylistEditor">') &&
  !back.includes('<section data-br-tab="playlists" id="brDJPlaylistEditor" hidden>'),
  'Show one native Back Room editor rather than a broken DJ iframe');
assert.ok(dj.includes("/control/playlists/save")&&dj.includes("/control/playlists")&&
  dj.includes("/control/custom-mix"),
  'Original DJ Booth playlist APIs are the shared master');
assert.ok(back.includes("geDJApi('/control/playlists/save'")&&
  back.includes("geDJApi('/control/playlists/delete'")&&
  back.includes("geDJApi('/control/custom-mix'"),
  'Back Room must save, delete and activate the real DJ records, not another playlist database');
assert.ok(back.includes("geDJApi('/control/library')")&&back.includes('id="brDJAlbumChoices"')&&
  back.includes('id="brDJSongChoices"'),
  'Back Room must show the original DJ library with album and per-song checkboxes');
assert.ok(back.includes("geDJApi('/control/playlists')")&&back.includes("geDJSavedPlaylists"),
  'Back Room must load actual DJ playlist IDs, names and song paths');
assert.ok(back.includes("cfg.music.publicPlaylists=geDJSavedPlaylists.map(")&&
  back.includes("bangersApproved&&String(playlist.name).trim().toLowerCase()==='bangers'")&&
  back.includes("cfg.music.publicDJPlaylistNames=visible?['Bangers']:[]"),
  'The published Radio MUSIC snapshot must come from explicitly approved original DJ records');
assert.ok(vault.includes('"/v1/public/dj-playlists"')&&vault.includes('meta.source!=="ge-radio"'),
  'Public playlist feed must be read-only and restricted to the original curated GE Radio entries');
assert.ok(radio.includes("https://vault.grandelement.com/v1/public/dj-playlists")&&
  radio.includes("GE_DJ_PUBLIC_PLAYLIST_SNAPSHOT_V2")&&
  radio.includes("publishedConfigNames.get(id)")&&
  radio.includes("OWNER-PUBLISHED ORIGINAL DJ SNAPSHOT"),
  'Radio MUSIC prefers live Vault playlists and falls back to owner-approved original DJ snapshots');
assert.ok(back.includes("refreshDJPlaylistSource()")&&back.includes("geDjTrustedTokenV1"),
  'Back Room should reuse the authenticated DJ device without creating a second playlist database');
assert.ok(back.includes('id="brAccessCustomCode"')&&back.includes("requested_code:"),
  'New Access Codes must accept a typed secret');
assert.ok(vault.includes("body.requested_code")&&vault.includes("This access code already exists"),
  'Vault must hash and safely validate owner-chosen codes');
assert.ok(back.includes("showCodeEditor();"),'Access Code editor must be visible without additional clicks');
assert.ok(back.includes('id="brScoresTable"')&&back.includes('async function loadBackroomScores()'),
  'All games should show real scores in the Back Room tab');
assert.ok(back.includes('id="brGameDefaultPlayers"')&&back.includes('id="brGameDefaultComputer"'),
  'General game defaults belong in an expandable group');
assert.ok(back.includes('<section data-br-tab="welcome">\n  <h2>WEBSITE STARTUP MUSIC</h2>'),
  'Website startup music belongs at bottom of WELCOME');
assert.ok(back.includes('<section data-br-tab="moon">\n  <h2>RADIO MOON SATELLITE</h2>'),
  'Radio Moon satellite controls belong only to MOON');
assert.ok(back.includes("const explicitlyPublic=new Set") &&
  back.includes("explicitlyPublic.has(String(playlist.id))") &&
  back.includes("const makePublic=$('brPlaylistPublic').checked") &&
  back.includes("syncPublicPlaylist(saved,name,included,makePublic)") &&
  !back.includes('<input id="brPlaylistPublic" type="checkbox" checked>'),
  'DJ playlists default private and require an explicit Back Room PUBLIC selection');
assert.ok(back.includes("window.GE_BACKROOM_DJ_PLAYLISTS_UPDATED=(items)=>") &&
  back.includes("playlists=items;playlistLoaded=true;"),
  'Saving a DJ playlist must refresh the Back Room playlist chooser');
assert.ok(vault.includes('config?.music?.publicPlaylists') &&
  vault.includes("publishedSongs=permitted.get(String(playlist.id))") &&
  vault.includes("if(meta.source!==\"ge-radio\")continue"),
  'Vault public playlist feed must require both owner publication and original DJ ownership');
assert.ok(radio.includes("allowed.has(item.id)") &&
  radio.includes("allowed.get(item.id).has(path)") &&
  radio.includes("DJ PLAYLIST PERMISSIONS UNAVAILABLE"),
  'Radio MUSIC must independently filter the Vault feed and fail closed on permission errors');
assert.ok(radio.includes("https://vault.grandelement.com/v1/public/access/redeem") &&
  radio.includes("scope:'radio'") &&
  radio.includes("GE_VAULT_RADIO_SESSION_V1") &&
  radio.includes("if(isLegacy){") &&
  radio.includes("verification:isLegacy?'client_only':'vault_redeemed_radio_scope'"),
  'Radio Gate must redeem Vault codes without granting them owner/demo LOVE flags');
assert.ok(vault.includes('"/v1/public/access/redeem"') &&
  vault.includes("async function accessRedeem(request,env)"),
  'Vault radio code validation must occur server-side');
const currentWorkerVersion=/const VERSION='([^']+)'/.exec(sw)?.[1]||'';
const currentRadioVersion=currentWorkerVersion.replace(/^([0-9]{4})[.]([0-9]{2})[.]([0-9]{2})/,'$1$2$3');
assert.ok(/^20[0-9]{2}[.][0-9]{2}[.][0-9]{2}-radio/.test(currentWorkerVersion) &&
  radio.includes('./sw.js?v='+currentRadioVersion) &&
  sw.includes("const MEDIA_CACHE='ge-radio-media-v4'"),
  'iPhone Radio service worker registration and media cache must match current Radio code');
assert.ok(back.includes("minlength=\"12\"") &&
  back.includes("/^[a-zA-Z0-9-]{12,64}$/.test(requested)"),
  'Custom Access Code editor must match the Vault minimum length');
console.log('PASS Back Room DJ playlist source, game defaults, scores, Moon and Welcome tabs, manually issued codes and syntax');
