import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync('backroom/index.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length);
for(const [index,match] of scripts.entries()){
  if(/src=|application\/json/.test(match[1]))continue;
  new Script(match[2],{filename:'backroom-'+index+'.js'});
}
for(const name of ['brAccessNewPrimary','brAccessLoadPrimary','brAccessSavePrimary',
  'brAccessDeletePrimary','brAccessSimpleBar','brAccessStatusPanel',
  'brAccessWorkbenchMessage','brAccessGameInfo','brAccessMusicCategory']){
  assert.ok(html.includes(name),'Missing simplified Access Codes control '+name);
}
assert.match(html,/\$\('brAccessDeletePrimary'\)\.addEventListener\('click'/);
assert.match(html,/void codeAction\('delete'\)/);
assert.match(html,/void saveCode\(!!editingCodeId\)/);
assert.match(html,/oldBar\.before\(\$\('brAccessEditor'\)\)/);
assert.match(html,/diag\.appendChild\(el\)/);
assert.match(html,/sel\.size=1/);
assert.match(html,/scopeBoxes\(\)\.forEach\(box=>box\.checked=scopes\.includes\(box\.value\)\)/);
assert.match(html,/appliedPlaylistIds=new Set\(row\?\.playlist_ids\|\|\[\]\)/);
assert.match(html,/assignedSongPaths=\[\.\.\.\(row\?\.track_paths\|\|\[\]\)\]/);
console.log('PASS: Back Room Access Codes workbench syntax, load/save/delete bindings, and saved playlist/song hydration');

const radioHtml=readFileSync('radio/index.html','utf8');
assert.match(html,/id="brAccessKeyHelpPanel"/);
assert.match(html,/id="brAccessReplaceKey"/);
assert.match(html,/THIS IS THE RADIO ACCESS KEY/);
assert.match(html,/\$\('brAccessReplaceKey'\)\.addEventListener\('click',\(\)=>void rotateSelectedCode\(\)\)/);
assert.match(html,/async function rotateSelectedCode\(\)/);
assert.match(html,/action:'rotate',id:row.id/);
assert.match(html,/KEY RESET AND VERIFIED/);
assert.match(html,/if\(selectedCode\(\)&&!selectedCode\(\)\.revoked\)showCodeEditor\(selectedCodeId\)/);
assert.match(radioHtml,/ACCESS KEY · NOT CODE NAME/);
assert.match(radioHtml,/Enter the complete secret shown when issued, not its saved name/);
console.log('PASS: clear radio-key generation, one-time copy, replacement and selection-safe editing');
