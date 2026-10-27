import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const js=await readFile(new URL('../vault-worker/src/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;

const adminToken='owner-unit-test',keyBytes=Buffer.alloc(32,17);
const fan={id:'fan_test_member',display_name:'Test Member',email:'private@example.invalid'};
let row=null,contentRow=null,secretRow=null,linkRow=null,audits=0;
let codeCount=0;
const db={
 prepare(sql){
   let params=[];
   const item={
     bind(...p){params=p;return item;},
     async first(){
       if(/^SELECT (?:id|code_id) FROM (?:access_code_policy|access_codes|access_code_content|access_code_deletions|access_code_fans) LIMIT 1$/.test(sql))return null;
       if(sql==='SELECT id FROM fans WHERE id=?')return params[0]===fan.id?{id:fan.id}:null;
       if(sql.includes('SELECT id FROM access_codes WHERE code_hash=?'))
         return row?.code_hash===params[0]?{id:row.id}:null;
       if(sql.includes('SELECT * FROM access_codes WHERE id=?'))
         return row?.id===params[0]?{...row}:null;
       if(sql.includes('SELECT id,code_hash,revoked_at FROM access_codes WHERE id=?'))
         return row?.id===params[0]?{id:row.id,code_hash:row.code_hash,revoked_at:row.revoked_at}:null;
       if(sql.includes('SELECT ciphertext FROM access_code_secrets WHERE code_id=?'))
         return secretRow?.code_id===params[0]?{ciphertext:secretRow.ciphertext}:null;
       throw Error('Unexpected D1 first(): '+sql);
     },
     async all(){
       if(sql.includes('SELECT id,display_name FROM fans'))return {results:[{id:fan.id,display_name:fan.display_name}]};
       if(sql.startsWith('SELECT * FROM ')){
         const table=sql.slice('SELECT * FROM '.length);
         return {results:({
           access_code_policy:[{id:1,enabled:1,updated_at:0}],
           access_codes:row?[row]:[],
           access_code_content:contentRow?[contentRow]:[],
           access_code_deletions:[],
           access_code_fans:linkRow?[linkRow]:[],
           access_code_secrets:secretRow?[secretRow]:[]
         })[table]||[]};
       }
       throw Error('Unexpected D1 all(): '+sql);
     },
     async run(){
       if(sql.startsWith('CREATE TABLE IF NOT EXISTS access_code_secrets'))return {meta:{changes:0}};
       if(sql.startsWith('INSERT INTO access_codes (id,label,code_hash')){
         assert.equal(row,null,'issue creates only one credential');
         row={id:params[0],label:params[1],code_hash:params[2],code_hint:params[3],
           scopes_json:params[4],duration_mode:params[5],duration_seconds:params[6],
           fixed_expires_at:params[7],expires_at:params[8],activated_at:params[9],
           max_uses:params[10],use_count:params[11],enabled:params[12],revoked_at:params[13],
           created_at:params[14],updated_at:params[15],first_used_at:null};
         codeCount++;return {meta:{changes:1}};
       }
       if(sql.startsWith('INSERT INTO access_code_content')){
         contentRow={code_id:params[0],playlist_ids_json:params[1],track_paths_json:params[2],updated_at:params[3]};
         return {meta:{changes:1}};
       }
       if(sql.startsWith('INSERT INTO access_code_secrets(code_id,ciphertext')){
         secretRow={code_id:params[0],ciphertext:params[1],updated_at:params[2]};
         return {meta:{changes:1}};
       }
       if(sql.startsWith('INSERT INTO access_code_fans')){
         linkRow={code_id:params[0],fan_id:params[1],updated_at:params[2]};
         return {meta:{changes:1}};
       }
       if(sql.startsWith('UPDATE access_codes SET label=?')){
         row.label=params[0];row.scopes_json=params[1];row.duration_mode=params[2];
         row.duration_seconds=params[3];row.fixed_expires_at=params[4];row.expires_at=params[5];
         row.max_uses=params[6];row.updated_at=params[7];return {meta:{changes:1}};
       }
       if(sql.startsWith('INSERT INTO audit_log')){audits++;return {meta:{changes:1}}}
       throw Error('Unexpected D1 run(): '+sql);
     }
   };
   return item;
 },
 async batch(items){
   const results=[];for(const item of items)results.push(await item.run());return results;
 }
};
const env={VAULT_DB:db,VAULT_HASH_KEY:'mock-vault-hmac-secret',
 VAULT_ACCESS_CODES_TOKEN:adminToken,VAULT_ENCRYPTION_KEY_B64:keyBytes.toString('base64'),
 ALLOWED_ORIGINS:'https://grandelement.com'};
async function call(path,body,authorized=true){
 const headers={'Origin':'https://grandelement.com'};
 if(authorized)headers.Authorization='Bearer '+adminToken;
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await worker.fetch(new Request('https://vault.grandelement.com'+path,{
   method:body===undefined?'GET':'POST',headers,
   ...(body===undefined?{}:{body:JSON.stringify(body)})
 }),env);
 return {status:response.status,result:await response.json()};
}
async function decryptSnapshot(ciphertext){
 const [iv,encrypted,other]=ciphertext.split('.');
 assert.equal(other,undefined);
 const key=await webcrypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['decrypt']);
 const plain=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64')},
   key,Buffer.from(encrypted,'base64'));
 return JSON.parse(Buffer.from(plain).toString('utf8'));
}
const endpoint='/v1/admin/access-codes';
const songs=['ge-music/music/Test/Test_01.mp3'];
let res=await call('/v1/admin/access-code-backup',undefined,false);
assert.equal(res.status,401,'backup not visible to visitors');
res=await call('/v1/admin/access-code-fans',undefined);
assert.equal(res.status,200);
assert.deepEqual(res.result.items,[{id:fan.id,name:fan.display_name}],
  'owner fan choices do not disclose email addresses');
const body={action:'issue',label:'Test customer',requested_code:'GE-ACCESS-TEST-USER-001',
  scopes:['music'],duration_mode:'none',activate_now:true,max_uses:0,
  fan_id:'fan_nonexistent',playlist_ids:['playlist_test'],track_paths:songs};
res=await call(endpoint,body);
assert.equal(res.status,400,'only existing fan IDs may be assigned');
assert.equal(row,null,'failed user link cannot issue a stray code');
res=await call(endpoint,{...body,fan_id:fan.id});
assert.equal(res.status,200,JSON.stringify(res.result));
assert.equal(res.result.ok,true);
assert.equal(codeCount,1);
assert.equal(linkRow.fan_id,fan.id);
assert.deepEqual(JSON.parse(contentRow.track_paths_json),songs);
assert.ok(secretRow.ciphertext&&!secretRow.ciphertext.includes(res.result.code));
const issuedId=res.result.id;
res=await call('/v1/admin/access-code-backup');
assert.equal(res.status,200);
const snapshot=await decryptSnapshot(res.result.ciphertext);
assert.equal(snapshot.tables.access_codes[0].id,issuedId);
assert.equal(snapshot.tables.access_code_fans[0].fan_id,fan.id);
assert.deepEqual(JSON.parse(snapshot.tables.access_code_content[0].track_paths_json),songs);
assert.ok(snapshot.tables.access_code_secrets[0].ciphertext);
assert.ok(!res.result.ciphertext.includes(fan.id));
res=await call(endpoint,{...body,action:'edit',id:issuedId,label:'Test customer edited',
  fan_id:'',track_paths:['ge-music/music/Test/Test_02.mp3']});
assert.equal(res.status,200,JSON.stringify(res.result));
assert.equal(codeCount,1,'edit must not issue another key');
assert.equal(row.id,issuedId,'edit retains same record');
assert.equal(linkRow.fan_id,null,'clearing a user assignment leaves code intact');
assert.deepEqual(JSON.parse(contentRow.track_paths_json),['ge-music/music/Test/Test_02.mp3']);
assert.ok(audits>=2);
console.log('PASS: real Worker issue/edit links Vault user, validates fan, saves songs and encrypted secrets');
console.log('PASS: owner-only encrypted snapshot can be decrypted, contains assignments, and never exposes plaintext user identity');
