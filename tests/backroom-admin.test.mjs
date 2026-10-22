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
const inlineScripts=[...back.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
assert.ok(inlineScripts.length>=1,'Back Room must have an inline script');
for(const [i,s]of inlineScripts.entries()){
  if(/src=|application\\/json/.test(s[1]))continue;
  new Script(s[2],{filename:'backroom-inline-'+i+'.js'});
}
const tabs=['home','content','universe','games','radio','playlists','access','gate','scores','presets'];
for(const tab of tabs){
  assert.ok(back.includes('data-tab="'+tab+'"'),'Missing tab: '+tab);
  assert.ok(back.includes('data-br-tab="'+tab+'"'),'Missing section: '+tab);
}
for(const id of ['brPlaylistSave','brPlaylistDelete','brPlaylistSearch','brPlaylistTracks',
  'brAccessIssue','brAccessMaster','brAccessList','brAccessMode','brAccessMaxUses',
  'brAccessCopy','save','publishLive','reset','lockBackroom']){
  assert.ok(back.includes('id="'+id+'"'),'Missing Back Room control: '+id);
}
assert.match(back,/backroomVaultManagers\.init\(\)/);
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
console.log('PASS Back Room 10 tabs, controls, Vault auth routes, code integrity, and JS syntax');
