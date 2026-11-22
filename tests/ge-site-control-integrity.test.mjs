// GE Studios control contract: prevent route drift, duplicate IDs and Sun Lab
// public/private regressions before publishing a new version.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';

const read=file=>readFileSync(file,'utf8');
// Every non-archived HTML entry point, including alternate DJ/studio screens.
const mainPages=[
  'index.html','radio/index.html','backroom/index.html','support/index.html',
  'vault/index.html','radio/preview-lab.html','dj/imac.html','dj/index.html',
  'ge-images/index.html','live/index.html','qr/index.html','studio/index.html',
  'modules/bk.html','qr/radio/index.html','radio-backend/dj-entry.html',
  'radio-backend/dj-lite.html','radio-backend/dj.html','radio-backend/live-dj.html',
  'radio/classic.html','radio/dj/index.html','radio/ge-clock.html','radio/ge-dj.html',
  'radio/offline-home.html','radio/preview-merch-legacy.html',
  'backroom/github-direct.html','backroom/high-scores.html',
  'backroom/music-upload.html','ge-images/img/manifest-creator.html',
  'radio/release-studio.html'
];
let assets=0,idsChecked=0;
for(const page of mainPages){
 const html=read(page);
 const counts=new Map();
 for(const match of html.matchAll(/<[\w:-]+\b[^>]*?\sid=(["'])([^"'<>]+)\1/gi)){
  counts.set(match[2],(counts.get(match[2])||0)+1);
  idsChecked++;
 }
 const duplicate=[...counts].filter(([_,number])=>number>1);
 assert.deepEqual(duplicate,[],page+': duplicate element IDs cause wrong controls to receive listeners');

 const missing=[];
 for(const match of html.matchAll(/<(?:script|link|img|audio|source|iframe|a)\b[^>]*?\b(?:src|href)=(["'])(.*?)\1/gi)){
  const raw=match[2].trim();
  if(!raw||/^(?:https?:|data:|blob:|mailto:|tel:|javascript:|about:|\/\/|#)/i.test(raw)||
    raw.includes('${')||raw.includes('{{'))continue;
  let local=raw.split(/[?#]/)[0];
  try{local=decodeURIComponent(local)}catch(_){missing.push(raw);continue}
  if(!local)continue;
  const resolved=local.startsWith('/')?
    path.resolve('.',local.slice(1)):path.resolve(path.dirname(page),local);
  const relative=path.relative('.',resolved);
  if(relative.startsWith('..')||path.isAbsolute(relative)){missing.push(raw);continue;}
  assets++;
  if(!existsSync(resolved)&&!existsSync(resolved+'.html')&&
    !existsSync(path.join(resolved,'index.html')))missing.push(raw);
 }
 assert.deepEqual(missing,[],page+': missing local resources/navigation targets');
}
const manifest=JSON.parse(read('radio/manifest.json'));
const saved=JSON.parse(read('config/site-live.json'));
const playlists=JSON.parse(read('playlists/registry.json'));
const available=new Set(manifest.files);
assert.equal(available.size,manifest.files.length,'master manifest cannot contain duplicate tracks');
for(const [name,paths] of [
 ['Radio master',saved.music.radioMasterSongPaths],
 ['Store',saved.music.catalogRouting.storeSongPaths],
 ['Player',saved.music.catalogRouting.playerSongPaths],
 ...playlists.playlists.map(item=>['Playlist '+item.name,item.songs])
]){
 assert.ok(Array.isArray(paths),name+' must have an explicit track list');
 assert.equal(new Set(paths).size,paths.length,name+' contains duplicate tracks');
 assert.deepEqual(paths.filter(p=>!available.has(p)),[],name+' references tracks absent from the manifest');
}
const radio=read('radio/index.html'),backroom=read('backroom/index.html');
const css=read('radio/radio-components.css'),vault=read('vault-worker/src/index.js');
assert.ok(saved.music.publicPlayer.scopes.includes('sunlab'),'public EQ Effects must be enabled in published settings');
assert.match(radio,/id="sunLabBtn"[^>]*aria-label="EQ Effects"/,'public button must say EQ Effects');
assert.match(radio,/const publicOnly=!geRadioSunLabPrivateAllowed\(\)/,'public EQ must not expose advanced sliders without Vault scope');
assert.match(radio,/sunLabPanel\.classList\.toggle\('ge-sunlab-public',!geRadioSunLabPrivateAllowed\(\)\)/);
assert.match(css,/#sunLabPanel\.ge-sunlab-public\.show #sunLabAdvancedTools/,'mobile advanced controls must remain hidden from guests');
assert.match(css,/#sunLabPanel\.ge-sunlab-public\.show #geSunLabTransparency/,'advanced transparency tuning needs code');
assert.match(backroom,/ADVANCED EQ CONTROLS · FOR THIS CODE ONLY/);
assert.match(vault,/capabilities:\{sun_lab:scopes\.includes\("sunlab"\)\}/,
 'only a validated Vault code can grant full Sun Lab variables');
assert.match(backroom,/const expiration=\$\('brAccessMode'\)\.closest\('details\.brAccessCategory'\)/,
 'Expiration must not hijack the Fans panel');
assert.match(backroom,/githubPlaylistAction/,'the publisher is the owner GitHub playlist writer');

console.log('PASS: '+mainPages.length+' primary pages; '+idsChecked+
 ' control IDs; '+assets+' local links/assets; all Music route snapshots;'+
 ' public EQ Effects versus scoped advanced Sun Lab; isolated Access Code and Fans UI.');
