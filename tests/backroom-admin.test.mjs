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
const tabs=['welcome','about','universe','games','radio','playlists','access','fans','moon','gate','scores','presets'];
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
assert.ok(back.includes('button:nth-child(n+5){grid-column:span 7!important}'), 'Four buttons per row including FANS');
assert.ok(back.includes('button[data-tab="radio"][aria-selected="true"]'), 'RADIO highlights when active');
assert.ok(!back.includes('Swipe the tabs sideways'),'No sideways-scrolling directions should remain');
assert.ok(!back.includes('Make changes here. SAVE keeps your working copy'),'Redundant intro must be removed');
assert.ok(!back.includes('<summary>SETTINGS</summary>'),'Settings must not consume its own text row');
assert.match(back,/aria-label="Back Room settings" title="Back Room settings"/);
assert.match(back,/if\(category==='gate'\|\|category==='welcome'\|\|category==='about'\|\|category==='access'\|\|category==='fans'\|\|category==='playlists'\|\|category==='moon'\|\|category==='music'\)\s*\{\s*heading\.remove\(\)/);
assert.ok(back.includes("category==='access'||category==='fans'||category==='playlists'"),'Access Codes and Fans open directly without a second accordion click');
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
assert.match(publisher,/\['issue','edit','reveal','rotate','activate','suspend','revoke','delete','master'\]/);
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
assert.ok(back.includes('id="brDJPlaylistEditor"')&&back.includes('id="brPlaylistName"')&&
  back.includes('/manage/github-playlists'),
  'Back Room playlist editor must use the canonical GitHub registry without changing the live DJ Booth');
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
assert.ok(back.includes("'/manage/github-playlists'")&&
  back.includes('accessPlaylistOptions()')&&
  back.includes('renderPlaylistViewer()')&&
  dj.includes("/control/playlists/save")&&dj.includes("/control/custom-mix"),
  'Back Room uses the canonical GitHub playlist writer while the original BLITZ DJ controller and its records are preserved');
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

const musicV5=read('radio/ge-music-v5.js');
const preview=read('radio/preview-lab.html');
const registry=JSON.parse(read('playlists/registry.json'));
assert.equal(registry.format,'ge-playlist-registry-v1');
assert.ok(Array.isArray(registry.playlists),'Owner playlist master must contain playlists');
assert.match(musicV5,/main\/playlists\/registry\.json\?refresh=/,
  'Radio Music reads the canonical GitHub playlist master');
assert.match(musicV5,/data\.playlists\.filter\(valid\)/,
  'All canonical GitHub playlist names appear in the Music loader; playback remains code-gated');
assert.match(musicV5,/musicAccessActive\(\)\?\.playlistIds/,
  'An unlisted playlist may be shown only when assigned to the access code');
assert.match(preview,/main\/playlists\/registry\.json\?refresh=/,
  'Embedded Radio Music preview reads the same GitHub playlist file');
assert.match(radio,/https:\/\/vault\.grandelement\.com\/v1\/public\/access\/redeem/,
  'Radio Gate redeems code through trusted GE Vault');
assert.match(radio,/scope:'radio'/);
assert.match(radio,/GE_VAULT_RADIO_SESSION_V1/);
assert.match(radio,/const isLegacy=false/,
  'There is no client-only LOVE special case');
assert.doesNotMatch(preview,/code!=='love'|GE_GATE_LOVE_V1/,
  'The historic hardcoded preview LOVE bypass must not return');
assert.match(vault,/async function accessRedeem\(request,env\)/);
assert.match(vault,/\/v1\/public\/access\/redeem/);
assert.match(vault,/normalizedCodeExperience\(body\)/);
assert.doesNotMatch(back,/id="brCodeAutopilot"|id="brCodeGames"|id="brCodeRadioPlaylist"/,
  'Red-crossed Access Code experience controls are removed, not hidden');
assert.match(back,/name="brAccessScope" value="radio"/);
assert.doesNotMatch(back,/name="brAccessScope" value="(?:website|music|albums|games)"/);
assert.match(back,/existing\?\.experience\|\|replacementExperience/,
  'Saved experience settings remain intact when editing existing codes');
assert.match(back,/brCodeFansPanel/);
assert.match(vault,/CREATE TABLE IF NOT EXISTS fan_code_links/);
assert.match(publisher,/\/manage\/fan-access/);
assert.match(musicV5,/data-access-view="album"/);
assert.match(musicV5,/data-access-view="playlist"/);
const currentWorkerVersion=/const VERSION='([^']+)'/.exec(sw)?.[1]||'';
const currentRadioVersion=currentWorkerVersion.replace(/^([0-9]{4})[.]([0-9]{2})[.]([0-9]{2})/,'$1$2$3');
assert.ok(/^20[0-9]{2}[.][0-9]{2}[.][0-9]{2}-.+/.test(currentWorkerVersion)&&
 radio.includes('./sw.js?v='+currentRadioVersion)&&
 sw.includes("const MEDIA_CACHE='ge-radio-media-v4'"),
 'iPhone Radio shell update must retain existing downloaded media');
assert.ok(back.includes("requested_code:editingCodeId?'':label") &&
 vault.includes('/^[A-Z0-9]{4,64}$/.test(accessNormalizeCode(requested))'),
 'Named Access Codes must use server-side credential validation');
const published=registry.playlists.filter(p=>p.visibility==='published');
const unlisted=registry.playlists.filter(p=>p.visibility==='unlisted');
assert.ok(unlisted.every(p=>!published.some(q=>q.id===p.id)),
 'Unlisted owner mixes are not in the anonymous public playlist set');
console.log('PASS: authenticated Back Room, canonical GitHub music master, Vault code validation, fan/code link, iPhone cache and code-based Music views');
assert.ok(back.includes('id="brTabFans"')&&back.includes('data-br-tab="fans"')&&
  back.includes("const categories=['welcome','about','universe','games','music','radio','moon','gate','access','fans'"),
  'FANS must be a separate top navigation tab alongside ACCESS CODES');
assert.ok(back.includes("$('brFansHome').appendChild(fanPanel)")&&
  back.includes("if(tab==='fans')"),
  'Fans editor must be mounted only in its new tab and refresh on selection');
for(const selector of [
  '#brPanel-access #brAccessReplaceKey',
  '#brPanel-access #brAccessShowActualKey',
  '#brPanel-access #brAccessKeyIdentity',
  '#brPanel-access #brAccessPlaylistNotice',
  '#brPanel-access .brAccessPrivateKeyDetails',
  '#brPanel-access .brAccessViewSongsLabel',
  '#brPanel-access .brAccessSaveAsPlaylistTools',
  '#brPanel-access #brAccessOneTime:not([hidden]){display:none!important}'
])assert.ok(back.includes(selector),'Obsolete Access Codes row must be hidden: '+selector);
assert.ok(back.includes('id="brAccessPlaylistChoices"')&&
  back.includes('id="brAccessSongChecklist"')&&back.includes('id="brAccessOrderSection"'),
  'Removing display clutter must preserve playlist selection and ordered individual songs');
console.log('PASS: Fans separated into top tab; crossed-out Access rows hidden without deleting Vault controls');
console.log('PASS Back Room DJ playlist source, game defaults, scores, Moon and Welcome tabs, manually issued codes and syntax');
