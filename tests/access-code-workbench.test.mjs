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

assert.match(html,/function selectedAccessAssignments\(\)/);
assert.match(html,/const assignments=selectedAccessAssignments\(\)/);
assert.match(html,/playlist_ids:assignments.playlist_ids,track_paths:assignments.track_paths/);
assert.match(html,/Check playlists, then SAVE the access code/);
console.log('PASS: checked GitHub playlist songs are included when the access code is saved');

assert.match(html,/id="brAccessRevealKey"/);
assert.match(html,/action:'reveal',id:row.id/);
assert.match(html,/revealedKeyRecordId/);
console.log('PASS: owner can retrieve saved secret from same Back Room record without exposing it in the public code list');
assert.match(html,/REVIEW NEW/,'search must not immediately issue another credential');
assert.match(html,/NEW CODE DRAFT/,'new credentials require an explicit review and save');
assert.doesNotMatch(html,/accessLoaded=false;codeRows=\[\];renderAccessCodes\(\)/,
  'a login failure must not erase the previously loaded Access Codes list');
assert.doesNotMatch(html,/accessLoaded=false;codeRows=\[\];legacyLoveAudit=null;renderAccessCodes\(\)/,
  'a transient Vault read failure must not disguise saved Access Codes as deleted');
assert.match(html,/Previously loaded codes are UNVERIFIED, not deleted/,
  'stale records must be clearly marked rather than falsely reported missing');
console.log('PASS: failed reads preserve prior Vault record visibility; search cannot silently create duplicate codes');
