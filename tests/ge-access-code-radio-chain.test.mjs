import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const load=path=>readFileSync(path,'utf8');
const vault=load('vault-worker/src/index.js');
const radio=load('radio/index.html');
const v5=load('radio/ge-music-v5.js');
const preview=load('radio/preview-lab.html');
const backroom=load('backroom/index.html');
const publisher=load('backroom/publisher-worker.js');
const registry=JSON.parse(load('playlists/registry.json'));
const inlineScripts=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(m=>!/src=|application\/json/i.test(m[1])).map(m=>m[2]);
for(const [name,source] of [['radio',radio],['preview',preview],['backroom',backroom]]){
 for(const [i,script] of inlineScripts(source).entries())
  new Script(script,{filename:name+'-inline-'+i});
}
new Script(v5,{filename:'radio/ge-music-v5.js'});
assert.match(backroom,/\/manage\/github-playlists/);
assert.match(publisher,/GITHUB_PLAYLISTS_PATH='playlists\/registry.json'/);
assert.equal(registry.format,'ge-playlist-registry-v1');
assert.ok(registry.playlists.some(p=>p.name==='Test 2'&&p.visibility==='unlisted'),
 'preserve Test 2 as an unlisted owner playlist, not a public playlist');
assert.match(vault,/\(scopes.includes\("radio"\)\&\&allowedPaths.length>0\)/,
 'radio codes with explicit assigned tracks may access only those tracks');
assert.match(vault,/music_session=\{token:unsigned/,
 'Gate redemption must provide a signed Music entitlement from D1');
assert.match(radio,/const m=result.music_session/,
 'Radio Gate must consume its returned Music entitlement');
assert.match(radio,/sessionStorage.setItem\('GE_MUSIC_CODE_SESSION_V1'/);
assert.match(backroom,/id="brAccessDisplayName"/,'owner must have a separate, optional fan/access display name');
assert.match(backroom,/if\(!existing&&\!displayName\)throw Error/,'new access codes require a listener name');
assert.match(backroom,/display_name:displayName/,'existing GE Vault code name field is saved');
assert.match(vault,/display_name:await codeListenerDisplayName\(env,row.id\)/,
 'Radio Gate inherits the saved name from the correct Vault code');
assert.match(radio,/v713-verified-listener-name/,'Radio uses the updated Music script');

assert.match(v5,/musicAccessActive\(\)/);
assert.match(v5,/state.view='access-code'/);
assert.match(v5,/action:'verify',token:access.token,track_path:track.path/,
 'Music V5 must verify every chosen track against Vault');
assert.match(preview,/GE_MUSIC_SESSION_ENDPOINT/);
assert.match(preview,/action:'verify',token:grant.token,track_path:t.path/);
assert.doesNotMatch(preview,/code!=='love'|GE_GATE_LOVE_V1/,
 'preview player must not hardcode LOVE as the sole code');
assert.match(preview,/main\/playlists\/registry.json\?refresh=/,
 'preview player and Radio Music must read the same published registry');
assert.match(preview,/d\.playlists\.filter/,
 'GE Music preview loads the same GitHub playlist names, including unlisted entries');
assert.match(preview,/UNLISTED · /,
 'unlisted tracks have a visible label rather than silently disappearing');
console.log('PASS: Back Room GitHub registry -> D1 code assignment -> signed Radio Gate Music entitlement -> two Music interfaces, no LOVE hardcode');

assert.doesNotMatch(v5,/access\.codeFallback|codeFallback:String/,'never show a visitor\'s private access key as a name');
assert.doesNotMatch(radio,/codeFallback:String/,'Gate must not store the private access key for display');
