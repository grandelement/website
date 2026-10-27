import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(path,'utf8');
const vault=read('vault-worker/src/index.js'),back=read('backroom/index.html'),
 publisher=read('backroom/publisher-worker.js'),radio=read('radio/index.html'),
 v5=read('radio/ge-music-v5.js'),preview=read('radio/preview-lab.html'),
 home=read('index.html'),schema=read('vault-worker/migrations/20261027_unified_access_experience.sql');
for(const [name,html] of [['backroom',back],['radio',radio],['preview',preview],['home',home]]){
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
assert.match(back,/id="brCodeGames"/);
assert.match(back,/id="brCodeAutopilot"/);
assert.match(back,/id="brCodeRadioPlaylist"/);
assert.match(back,/brCodeFansPanel/);
assert.match(back,/code_id:fanCode.value/);
assert.match(radio,/const m=result.music_session/);
assert.match(radio,/playlistIds:Array.isArray\(m.playlist_ids\)/);
assert.match(radio,/experience:\{games_enabled:result.experience/);
assert.match(v5,/data-access-view="order"/);
assert.match(v5,/data-access-view="album"/);
assert.match(v5,/data-access-view="playlist"/);
assert.match(v5,/state.assignedLists/);
assert.match(v5,/state.accessView==='album'/);
assert.match(v5,/GEMusicV5Bridge\?\.play\?\.\(track.path,queue\)/);
assert.match(preview,/window.GEPlayLibraryQueue=function/);
assert.match(home,/ge-code-hide-autopilot/);
assert.match(home,/ge-code-hide-games/);
assert.doesNotMatch(home,/VAULT_ADMIN_TOKEN\s*=/);
console.log('PASS: unified owner code settings, D1 fan-code association, Radio access receipt, personal music views, Website presentation, and script syntax');
