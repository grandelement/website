import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(path,'utf8');
const support=read('support/index.html');
const vault=read('vault-worker/src/index.js'),back=read('backroom/index.html'),
 publisher=read('backroom/publisher-worker.js'),radio=read('radio/index.html'),
 v5=read('radio/ge-music-v5.js'),preview=read('radio/preview-lab.html'),
 home=read('index.html'),schema=read('vault-worker/migrations/20261027_unified_access_experience.sql');
for(const [name,html] of [['backroom',back],['radio',radio],['preview',preview],['home',home],['store',support]]){
 for(const [i,m] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
  if(/src=|application\/json/i.test(m[1]))continue;
  new Script(m[2],{filename:name+':inline:'+i});
 }
}
new Script(v5,{filename:'Music V5'});
assert.match(schema,/CREATE TABLE IF NOT EXISTS access_code_experience/);
assert.match(schema,/CREATE TABLE IF NOT EXISTS fan_code_links/);
assert.match(vault,/normalizedCodeExperience\(body\)/);
assert.match(vault,/codeExperienceStatement\(env,codeId,experience,t\)/);
assert.match(vault,/experience_games_enabled/);
assert.match(vault,/radio_playlist_id/);
assert.match(vault,/adminFanAccess\(request,env\)/);
assert.match(vault,/adminAuthorized\(request,env\)/);
assert.match(publisher,/url.pathname==='\/manage\/fan-access'/);
assert.match(publisher,/VAULT_ADMIN_TOKEN/);
assert.doesNotMatch(back,/id="brCodeGames"|id="brCodeAutopilot"|id="brCodeRadioPlaylist"/,
  'Access Code presentation options were intentionally removed from the interface');
assert.match(back,/name="brAccessScope" value="radio"/);
assert.match(back,/existing\?\.scopes\|\|replacementLegacyScopes/,
  'Previously granted nonradio scope values are preserved on an edit');
assert.match(back,/brCodeFansPanel/);
assert.match(back,/code_id:fanCode.value/);
assert.match(back,/id='brCodeRecentLabel'/);
assert.match(back,/action:'label',anon_id:selectedRecentAnon/);
assert.match(vault,/return adminSetFanLabel\(req,env\)/);
assert.match(publisher,/\['assign','label','create'\]/);
assert.doesNotMatch(back,/selectedRecentAnon=String\(f\.ip/);
assert.match(radio,/const m=result.music_session/);
assert.match(radio,/playlistIds:Array.isArray\(m.playlist_ids\)/);
assert.match(radio,/experience:\{games_enabled:result.experience/);
// The current Music window combines access views into SONGS and PLAYLISTS.
assert.match(v5,/data-tab="songs"/);
assert.match(v5,/data-tab="playlists"/);
assert.match(v5,/class="songFilter"/);
assert.match(v5,/class="playlistFilter"/);
assert.match(v5,/state.assignedLists/);
assert.match(v5,/state.view==='access-code'/);
assert.match(v5,/const allowed=new Set\(access.allowed\)/);
assert.match(v5,/state.accessView==='playlist'/);
assert.match(v5,/GEMusicV5Bridge\?\.play\?\.\(track.path,queue,playlistName,\{custom,labels\}\)/);
assert.match(preview,/window.GEPlayLibraryQueue=function/);
assert.match(home,/ge-code-hide-autopilot/);
assert.match(home,/ge-code-hide-games/);
assert.doesNotMatch(home,/VAULT_ADMIN_TOKEN\s*=/);
assert.match(vault,/accessRestoreDevice\(request,env\)/,'Vault must recheck remembered device against active D1 code');
assert.match(vault,/ge-access-device-v1/,'Remembered token must be HMAC signed');
assert.match(radio,/restoreRememberedRadioDevice\(/,'Radio must restore scoped access from a signed grant');
assert.match(support,/restoreRememberedFreePass\(/,'Store must restore signed LOVE free-pass preview');
console.log('PASS: unified owner code settings, D1 fan-code association, Radio access receipt, personal music views, Website presentation, and script syntax');
