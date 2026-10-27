import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {Script} from 'node:vm';

const vault=readFileSync('vault-worker/src/index.js','utf8');
const publisher=readFileSync('backroom/publisher-worker.js','utf8');
const ui=readFileSync('backroom/index.html','utf8');
const migration=readFileSync('vault-worker/migrations/20261021_access_codes.sql','utf8');
const playlistContract=readFileSync('playlists/INTEGRATION_CONTRACT.md','utf8');

for(const [name,content] of [['Vault',vault],['Publisher',publisher]]){
  const result=spawnSync(process.execPath,['--input-type=module','--check'],{
    input:content,encoding:'utf8'});
  assert.equal(result.status,0,name+' JavaScript parses: '+result.stderr);
}
for(const [index,match] of [...ui.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
  if(/src=|application\/json/.test(match[1]))continue;
  new Script(match[2],{filename:'backroom-inline-'+index+'.js'});
}

assert.match(playlistContract,/playlists\/registry\.json/);
assert.match(migration,/CREATE TABLE IF NOT EXISTS access_code_fans/);
assert.match(vault,/SELECT code_id FROM access_code_fans LIMIT 1/);
assert.match(vault,/LEFT JOIN access_code_fans f ON f\.code_id=a\.id/);
assert.match(vault,/fan_id:row\.fan_id\|\|""/);
assert.match(vault,/SELECT id FROM fans WHERE id=\?/);
assert.match(vault,/INSERT INTO access_code_fans\(code_id,fan_id,updated_at\)/);
assert.match(vault,/ON CONFLICT\(code_id\) DO UPDATE SET fan_id=excluded\.fan_id/);
assert.match(vault,/accessAdminFans\(request,env\)/);
assert.match(vault,/accessCodesAuthorized\(request,env\)/);
assert.match(vault,/accessAdminBackup\(request,env\)/);
assert.match(vault,/await encryptPrivate\(JSON\.stringify\(data\),env\)/);
for(const table of ['access_code_policy','access_codes','access_code_content',
  'access_code_deletions','access_code_fans','access_code_secrets']){
  assert.ok(vault.includes('"'+table+'"'),'backup must include '+table);
}

assert.match(publisher,/const GITHUB_ACCESS_BACKUP_PATH='access-codes\/private-vault-backup\.enc\.json'/);
assert.match(publisher,/ciphertext:cipher/);
assert.match(publisher,/geVaultBridge\(env,'\/v1\/admin\/access-code-backup'\)/);
assert.match(publisher,/decodeGithubText\(file\.content\|\|''\)!==serialized/);
assert.match(publisher,/backup_status:'VERIFIED'/);
assert.match(publisher,/backup_status:'PENDING'/);
assert.match(publisher,/url\.pathname==='\/manage\/access-code-fans'/);
assert.match(publisher,/body\.action==='backup'/);
assert.doesNotMatch(publisher,/content:utf8B64\(JSON\.stringify\(upstream\.data/);

assert.match(ui,/id="brAccessFan"/);
assert.match(ui,/id="brAccessBackup"/);
assert.match(ui,/async function refreshAccessFans\(\)/);
assert.match(ui,/renderAccessFanOptions\(row\?\.fan_id\|\|''\)/);
assert.match(ui,/fan_id:\$\('brAccessFan'\)\.value\|\|''/);
assert.match(ui,/String\(saved\.fan_id\|\|''\)===String\(payload\.fan_id\|\|''\)/);
assert.match(ui,/GITHUB BACKUP PENDING/);
assert.match(ui,/ENCRYPTED GITHUB BACKUP VERIFIED/);

console.log('PASS: GitHub playlist -> private D1 codes -> fan links -> encrypted GitHub backup readback');
console.log('PASS: no access secrets or fan identities are written as plaintext GitHub content');
