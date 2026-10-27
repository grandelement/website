import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=await readFile(new URL('../vault-worker/src/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const key='unit-test-only-hmac',owner='mock-owner-only';
const hash=code=>createHmac('sha256',key).update('ge-access-v1:'+code.trim().toUpperCase().replace(/^GE[\\s-]+/,'').replace(/[\\s-]/g,'')).digest('hex');
const oldCode='GE-ABCD-1234-DEAD-BEEF';
const t=Math.floor(Date.now()/1000);
const row={id:'access_xfiles',label:'Xfiles',code_hash:hash(oldCode),code_hint:'BEEF',
 scopes_json:JSON.stringify(['website','radio','music','albums','games']),
 duration_mode:'none',duration_seconds:0,fixed_expires_at:null,expires_at:null,
 activated_at:t,first_used_at:null,max_uses:0,use_count:3,enabled:1,revoked_at:null,
 created_at:t-60,updated_at:t};
const assignments={playlist_ids_json:JSON.stringify(['playlist_saved']),track_paths_json:JSON.stringify(['ge-music/music/Fire_01.mp3'])};
let audits=0,encryptedSecret=null;
const db={prepare(sql){
 let p=[];const o={bind(...args){p=args;return o;},
 async first(){
   if(/^SELECT (id|code_id) FROM (access_code_policy|access_codes|access_code_content|access_code_deletions|access_code_experience|fan_code_links) LIMIT 1$/.test(sql))return null;
   if(sql.includes('SELECT * FROM access_codes WHERE id='))return row.id===p[0]?{...row}:null;
   if(sql.includes('SELECT id FROM access_codes WHERE code_hash='))return row.code_hash===p[0]?{id:row.id}:null;
   if(sql.includes('SELECT id,code_hash,revoked_at FROM access_codes WHERE id='))return row.id===p[0]?{id:row.id,code_hash:row.code_hash,revoked_at:row.revoked_at}:null;
   if(sql.includes('SELECT ciphertext FROM access_code_secrets WHERE code_id='))return row.id===p[0]&&encryptedSecret?{ciphertext:encryptedSecret}:null;
   if(sql.includes('FROM access_code_policy'))return {enabled:1};
   if(sql.includes('FROM access_codes a'))return row.code_hash===p[0]?{...row,...assignments,deleted_at:null}:null;
   throw Error('Unexpected first SQL '+sql);
 },
 async run(){
   if(sql.includes('CREATE TABLE IF NOT EXISTS access_code_secrets'))return {meta:{changes:0}};
   if(sql.includes('INSERT INTO access_code_secrets(code_id,ciphertext,updated_at) SELECT id,')){
     if(row.id===p[2]&&row.code_hash===p[3])encryptedSecret=p[0];
     return {meta:{changes:encryptedSecret?1:0}};
   }
   if(sql.includes('UPDATE access_codes SET code_hash=')){
     assert.equal(p[3],row.id);assert.equal(p[4],row.code_hash);
     row.code_hash=p[0];row.code_hint=p[1];row.updated_at=p[2];
     return {meta:{changes:1}};
   }
   if(sql.includes('UPDATE access_codes SET use_count=')){
     row.use_count++;return {meta:{changes:1}};
   }
   if(sql.includes('INSERT INTO audit_log')){audits++;return {meta:{changes:1}};}
   throw Error('Unexpected write '+sql);
 }};
 return o;
},async batch(prepared){return Promise.all(prepared.map(p=>p.run()));}
};
const env={VAULT_DB:db,VAULT_ACCESS_CODES_TOKEN:owner,VAULT_HASH_KEY:key,
 VAULT_ENCRYPTION_KEY_B64:Buffer.alloc(32,7).toString('base64'),
 ALLOWED_ORIGINS:'https://grandelement.com'};
async function call(path,body,authorized=false){
 const headers={'Content-Type':'application/json','Origin':'https://grandelement.com'};
 if(authorized)headers.Authorization='Bearer '+owner;
 const response=await worker.fetch(new Request('https://vault.grandelement.com'+path,{method:'POST',headers,body:JSON.stringify(body)}),env);
 return {status:response.status,result:await response.json()};
}
const admin='/v1/admin/access-codes',redeem='/v1/public/access/redeem';
let r=await call(admin,{action:'reveal',id:row.id});
assert.equal(r.status,401,'anonymous cannot reveal saved secrets');
r=await call(admin,{action:'reveal',id:row.id},true);
assert.equal(r.status,409,'legacy hashed Xfiles key requires one safe reset');
r=await call(admin,{action:'rotate',id:row.id});
assert.equal(r.status,401,'rotation is owner-only');
r=await call(redeem,{code:oldCode,scope:'radio'});
assert.equal(r.status,200,'existing key valid before rotation');
const before={...row};
r=await call(admin,{action:'rotate',id:row.id},true);
assert.equal(r.status,200,JSON.stringify(r.result));
assert.equal(r.result.id,row.id,'same access code record');
assert.match(r.result.code,/^GE-(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/);
assert.notEqual(row.code_hash,before.code_hash);
assert.equal(row.code_hint,r.result.code_hint);
for(const field of ['id','label','scopes_json','duration_mode','expires_at','max_uses','use_count','enabled','activated_at']){
 assert.deepEqual(row[field],before[field],'rotation preserves '+field);
}
assert.equal(audits>=1,true);
const newCode=r.result.code;
const recovered=await call(admin,{action:'reveal',id:row.id},true);
assert.equal(recovered.status,200,'owner can retrieve encrypted key');
assert.equal(recovered.result.code,newCode,'recovered secret matches generated secret');
assert.ok(encryptedSecret&&!encryptedSecret.includes(newCode),'database stores ciphertext, not plaintext');
r=await call(redeem,{code:oldCode,scope:'radio'});
assert.equal(r.status,403,'old key no longer redeems');
r=await call(redeem,{code:newCode,scope:'radio'});
assert.equal(r.status,200,'new key redeems after rotation');
assert.equal(r.result.ok,true);
console.log('PASS: owner-only key reset and retrieval, AES-GCM ciphertext at rest, old key revoked, Radio accepts new key');
