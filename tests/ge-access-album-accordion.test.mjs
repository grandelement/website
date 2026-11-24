import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const html=await read('../backroom/index.html');
const css=await read('../backroom/owner-unified-ui.css');
const start=html.indexOf('  function accessSongOptions(){');
const end=html.indexOf('  async function saveAccessSelectionAsPlaylist(){',start);
assert.ok(start>0&&end>start,'must find the real Access song renderer');
const code=html.slice(start,end);
new Script(code,{filename:'Access song renderer'});
assert.match(code,/const expanded=new Set\(\[\.\.\.host\.querySelectorAll\('details\.brAccessAlbumGroup\[open\]'\)\]/,
 're-render must record expanded album groups');
assert.match(code,/const group=create\('details','','brAccessAlbumGroup'\)/,
 'each album must be natively expandable');
assert.match(code,/const summary=create\('summary',album\+' · '\+tracks\.length\+' SONGS'\)/,
 'album heading must be the expansion target');
assert.match(code,/group\.open=expanded\.has\(album\)\|\|!!query\|\|!!\$\('brAccessAlbum'\)\.value\|\|view==='checked'/,
 'checkbox rerenders keep expanded albums open');
assert.match(code,/all\.setAttribute\('aria-label','Select all '\+album\+' songs'\)/,
 'album Select All permissions stay intact');
assert.match(code,/assignedSongPaths=\[\.\.\.set\];accessSongOptions\(\);assignedSongsUI\(\)/,
 'selection changes still use the existing saved song paths');
assert.match(css,/details\.brAccessAlbumGroup>summary::before/);
assert.match(css,/details\.brAccessAlbumGroup>summary::after/);
assert.match(css,/details\.brAccessAlbumGroup\[open\]>summary::after\{content:"CLOSE"\}/);
assert.match(html,/owner-unified-ui\.css\?v=20261124-c/);
console.log('PASS: Access song groups expand clearly and preserve state and original checkbox data');
