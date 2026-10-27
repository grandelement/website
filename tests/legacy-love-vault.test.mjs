import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const js=await readFile(new URL('../vault-worker/src/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;
const secret='mock-test-vault-hmac-not-production',owner='unit-test-only-owner-token';
const legacyHash=createHmac('sha256',secret).update('ge-access-v1:LOVE').digest('hex');
let record=null,contentRow=null,policy={enabled:1},auditCount=0,migrationCount=0;
let schemaReady=false,schemaBatches=0,schemaCreated=new Set();
const db={
 prepare(sql){
  let p=[];const x={
   bind(...args){p=args;return x;},
   async first(){
    if(sql==='SELECT id FROM playlists LIMIT 1')return null;
    if(/^SELECT (id|code_id) FROM (access_code_policy|access_codes|access_code_content|access_code_deletions) LIMIT 1$/.test(sql)){
      if(!schemaReady)throw Error('D1: no such table: access_codes');
      return null;
    }
    if(sql.includes('FROM access_code_policy'))return policy;
    if(sql.includes('SELECT id,code_hash,revoked_at FROM access_codes WHERE id='))return record?.id===p[0]?{id:record.id,code_hash:record.code_hash,revoked_at:record.revoked_at}:null;
    if(sql.includes('SELECT id,scopes_json FROM access_codes WHERE code_hash='))return record?.code_hash===p[0]?{id:record.id,scopes_json:record.scopes_json}:null;
    if(sql.includes('SELECT id FROM access_codes WHERE code_hash='))return record?.code_hash===p[0]?{id:record.id}:null;
    if(sql.includes('FROM access_codes a')){
      if(sql.includes('a.code_hash=?')&&!record?.code_hash)return null;
      if(sql.includes('a.code_hash=?')&&p[0]!==record.code_hash)return null;
      return record?{...record,playlist_ids_json:contentRow?.playlist_ids_json||'[]',
       track_paths_json:contentRow?.track_paths_json||'[]',deleted_at:null}:null;
    }
    if(sql.includes('SELECT * FROM access_codes WHERE id='))return record?.id===p[0]?record:null;
    throw Error('Unexpected query: '+sql);
   },
   async all(){
    if(sql.includes('FROM access_codes a'))return {results:record?[{...record,
      playlist_ids_json:'[]',track_paths_json:'[]'}]:[]};
    throw Error('Unexpected list: '+sql);
   },
   async run(){
    if(sql.includes('CREATE TABLE IF NOT EXISTS')||sql.includes('CREATE INDEX IF NOT EXISTS')){
      schemaCreated.add(sql.slice(0,95));return {meta:{changes:1}}
    }
    if(sql.includes('INSERT OR IGNORE INTO access_code_policy'))
      return {meta:{changes:1}};
    if(sql.includes('INSERT INTO audit_log')){auditCount++;return {meta:{changes:1}}}
    if(sql.includes('INSERT OR IGNORE INTO access_codes')){
      if(!record){
        record={id:p[0],label:p[1],code_hash:p[2],code_hint:p[3],scopes_json:p[4],
          duration_mode:p[5],duration_seconds:p[6],fixed_expires_at:p[7],expires_at:p[8],
          activated_at:p[9],max_uses:p[10],use_count:p[11],enabled:p[12],revoked_at:p[13],
          created_at:p[14],updated_at:p[15],first_used_at:null};
        migrationCount++;
      }
      return {meta:{changes:1}};
    }
    if(sql.includes('INSERT OR IGNORE INTO access_code_content')){
      if(!contentRow)contentRow={code_id:p[0],playlist_ids_json:p[1],track_paths_json:p[2]};
      return {meta:{changes:1}};
    }
    if(sql.includes('UPDATE access_codes SET scopes_json=')){
      if(record?.id===p[4]&&record.code_hash===p[5]&&record.scopes_json===p[6]&&!record.revoked_at){
        record.scopes_json=p[0];if(record.label===p[1])record.label=p[2];
        record.updated_at=p[3];return {meta:{changes:1}};
      }
      return {meta:{changes:0}};
    }
    if(sql.includes('UPDATE access_codes SET use_count=')){
      if(!record.enabled||record.revoked_at||(record.max_uses>0&&record.use_count>=record.max_uses))
        return {meta:{changes:0}};
      record.use_count++;record.first_used_at??=p[0];record.expires_at??=p[1];
      return {meta:{changes:1}};
    }
    if(sql.includes('UPDATE access_codes SET enabled=0')||sql.includes('UPDATE access_codes SET enabled=1')){
      record.enabled=sql.includes('SET enabled=1')?1:0;
      if(sql.includes('revoked_at='))record.revoked_at=p[0];
      return {meta:{changes:1}};
    }
    throw Error('Unexpected write: '+sql);
   }
  };return x;
 },
 async batch(prepared){
   for(const statement of prepared)await statement.run();
   if(prepared.length>=7){schemaReady=true;schemaBatches++;}
   return prepared.map(()=>({meta:{changes:1}}))
 }
};
const env={VAULT_DB:db,VAULT_HASH_KEY:secret,VAULT_ACCESS_CODES_TOKEN:owner,ALLOWED_ORIGINS:'https://grandelement.com'};
async function request(path,body,admin=false){
 const headers={'Origin':'https://grandelement.com'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(admin)headers.Authorization='Bearer '+owner;
 const result=await worker.fetch(new Request('https://vault.grandelement.com'+path,
   {method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 return {status:result.status,data:await result.json()};
}
const admin='/v1/admin/access-codes',redeem='/v1/public/access/redeem';
let r=await request(admin);
assert.equal(r.status,401,'anonymous cannot seed or inspect code records');
assert.equal(record,null);
r=await request('/health');
assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(r.data.access_codes_ready,true,'public health confirms all four D1 tables');
assert.equal(schemaBatches,1,'health safely initializes the schema exactly once');
assert.equal(record,null,'health never creates or re-enables LOVE');
r=await request(admin,undefined,true);
assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(r.data.items.length,1);
assert.equal(r.data.items[0].label,'LOVE · Original All Access');
assert.deepEqual(r.data.items[0].scopes,['website','radio','music','albums','games']);
assert.equal(record.code_hash,legacyHash,'LOVE hashed with private Vault secret');
assert.equal(schemaReady,true,'missing D1 Access Codes tables must be created by authenticated GET');
assert.equal(schemaBatches,1,'Access Codes schema migrated exactly once');
assert.ok(schemaCreated.size>=6,'all Access Codes CREATE TABLE and INDEX statements run');
assert.equal(migrationCount,1);
r=await request(redeem,{code:'LoVe',scope:'radio'});
assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(r.data.ok,true);
r=await request(redeem,{code:'LOVE',scope:'music'});
assert.equal(r.status,200,'original LOVE grants Music');
r=await request(redeem,{code:'LOVE',scope:'albums'});
assert.equal(r.status,200,'original LOVE grants Albums');
r=await request(redeem,{code:'LOVE',scope:'games'});
assert.equal(r.status,200,'original LOVE grants Games');
r=await request(admin,{action:'reveal',id:'access_legacy_love_v1'},true);
assert.equal(r.status,200,'owner can retrieve historic LOVE credential');
assert.equal(r.data.code,'LOVE');
record.scopes_json=JSON.stringify(['radio']);
record.label='LOVE · Original Radio Gate';
r=await request(admin,undefined,true);
assert.deepEqual(r.data.items[0].scopes,['website','radio','music','albums','games'],
  'existing mis-imported Radio-only LOVE is upgraded in-place');
assert.equal(r.data.items[0].label,'LOVE · Original All Access');
assert.equal(migrationCount,1,'permission correction does not issue a second LOVE record');
r=await request(redeem,{code:'ABCD',scope:'radio'});
assert.equal(r.status,403,'other weak four-character codes never work');
r=await request(admin,undefined,true);
assert.equal(r.data.items.length,1);
assert.equal(migrationCount,1,'repeat GET must not create duplicate');
assert.equal(schemaBatches,1,'later GETs must reuse the tables and preserve code records');
r=await request(admin,{action:'suspend',id:'access_legacy_love_v1'},true);
assert.equal(r.status,200,JSON.stringify(r.data));
r=await request(redeem,{code:'LOVE',scope:'radio'});
assert.equal(r.status,403,'suspended LOVE rejected');
r=await request(admin,undefined,true);
assert.equal(migrationCount,1,'GET must not re-enable suspended LOVE');
r=await request(admin,{action:'activate',id:'access_legacy_love_v1'},true);
assert.equal(r.status,200,JSON.stringify(r.data));
r=await request(redeem,{code:'LOVE',scope:'radio'});
assert.equal(r.status,200,'reactivation works');
r=await request(admin,{action:'revoke',id:'access_legacy_love_v1'},true);
assert.equal(r.status,200,JSON.stringify(r.data));
r=await request(redeem,{code:'LOVE',scope:'radio'});
assert.equal(r.status,403,'revoked LOVE rejected');
r=await request(admin,undefined,true);
assert.equal(migrationCount,1,'revoked LOVE cannot auto-reappear');
r=await request(admin,{action:'issue',label:'four-char unsafe',scopes:['radio'],
 duration_mode:'none',requested_code:'ABCD'},true);
assert.equal(r.status,400,'new short codes remain disallowed');
assert.ok(auditCount>=4);
console.log('PASS: original LOVE credential stays active with all five scopes, owner-retrievable, and in-place migration preserves suspension/revocation');
