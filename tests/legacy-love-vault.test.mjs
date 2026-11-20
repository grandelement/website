// Regression: LOVE is not privileged, auto-created or blocked.
// It follows the exact same Vault record, scopes, expiry and HMAC rules
// as every Back Room-issued access code.
import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const source=await readFile(new URL('../vault-worker/src/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const owner='test-vault-owner',key='test-hash-key-not-production';
const rows=new Map(),contents=new Map(),secrets=new Map(),names=new Map();
let audits=0;
const policy={enabled:1},db={
 prepare(sql){
  let p=[];
  const q={
   bind(...args){p=args;return q},
   async first(){
    if(sql==='SELECT id FROM playlists LIMIT 1')return null;
    if(/^(SELECT id FROM access_code_policy LIMIT 1|SELECT id FROM access_codes LIMIT 1|SELECT code_id FROM (access_code_content|access_code_deletions|access_code_experience) LIMIT 1|SELECT fan_id FROM fan_code_links LIMIT 1)$/.test(sql))return null;
    if(sql.includes('FROM access_code_policy'))return policy;
    if(sql.includes('SELECT id FROM access_codes WHERE code_hash=')){
     const row=[...rows.values()].find(x=>x.code_hash===p[0]);
     return row?{id:row.id}:null;
    }
    if(sql.includes('SELECT id,code_hash,revoked_at FROM access_codes WHERE id=')){
     const row=rows.get(p[0]);
     return row?{id:row.id,code_hash:row.code_hash,revoked_at:row.revoked_at}:null;
    }
    if(sql.includes('SELECT * FROM access_codes WHERE id='))return rows.get(p[0])||null;
    if(sql.includes('SELECT ciphertext FROM access_code_secrets')){
     const ciphertext=secrets.get(p[0]);return ciphertext?{ciphertext}:null;
    }
    if(sql.includes('FROM access_codes a')){
     const row=sql.includes('a.code_hash=?')?[...rows.values()].find(r=>r.code_hash===p[0]):rows.get(p[0]);
     if(!row)return null;
     const content=contents.get(row.id)||{playlist_ids_json:'[]',track_paths_json:'[]'};
     return {...row,...content,deleted_at:null,display_name:names.get(row.id)||''};
    }
    throw Error('Unexpected SELECT '+sql);
   },
   async all(){
    if(sql.includes('FROM access_codes a'))return {results:[...rows.values()].map(row=>({
     ...row,...(contents.get(row.id)||{playlist_ids_json:'[]',track_paths_json:'[]'}),
     display_name:names.get(row.id)||'',deleted_at:null
    }))};
    throw Error('Unexpected list '+sql);
   },
   async run(){
    if(sql.includes('CREATE TABLE IF NOT EXISTS')||sql.includes('CREATE INDEX IF NOT EXISTS'))return {meta:{changes:0}};
    if(sql.includes('INSERT INTO audit_log')){audits++;return {meta:{changes:1}};}
    if(sql.includes('INSERT INTO access_codes (id,label,code_hash,')){
     rows.set(p[0],{id:p[0],label:p[1],code_hash:p[2],code_hint:p[3],
      scopes_json:p[4],duration_mode:p[5],duration_seconds:p[6],
      fixed_expires_at:p[7],expires_at:p[8],activated_at:p[9],
      max_uses:p[10],use_count:p[11],enabled:p[12],revoked_at:p[13],
      created_at:p[14],updated_at:p[15],first_used_at:null});
     return {meta:{changes:1}};
    }
    if(sql.includes('INSERT INTO access_code_content')){
     contents.set(p[0],{playlist_ids_json:p[1],track_paths_json:p[2]});
     return {meta:{changes:1}};
    }
    if(sql.includes('INSERT INTO access_code_secrets')){
     secrets.set(p[0],p[1]);return {meta:{changes:1}};
    }
    if(sql.includes('INSERT INTO access_code_display_names')){
     names.set(p[0],p[1]);return {meta:{changes:1}};
    }
    if(sql.includes('UPDATE access_codes SET label=?,scopes_json=')){
     const row=rows.get(p[8]);
     Object.assign(row,{label:p[0],scopes_json:p[1],duration_mode:p[2],duration_seconds:p[3],
      fixed_expires_at:p[4],expires_at:p[5],max_uses:p[6],updated_at:p[7]});
     return {meta:{changes:1}};
    }
    if(sql.includes('UPDATE access_codes SET use_count=')){
     const row=rows.get(p[3]);
     if(!row||!row.enabled||row.revoked_at)return {meta:{changes:0}};
     row.use_count++;row.first_used_at??=p[0];row.expires_at??=p[1];
     return {meta:{changes:1}};
    }
    throw Error('Unexpected write '+sql);
   }
  };
  return q;
 },
 async batch(statements){for(const stmt of statements)await stmt.run();return statements.map(()=>({meta:{changes:1}}));}
};
const env={VAULT_DB:db,VAULT_HASH_KEY:key,VAULT_ENCRYPTION_KEY_B64:Buffer.alloc(32,7).toString('base64'),
 VAULT_ACCESS_CODES_TOKEN:owner,ALLOWED_ORIGINS:'https://grandelement.com'};
async function call(path,body,authorized=false){
 const headers={Origin:'https://grandelement.com'};
 if(authorized)headers.Authorization='Bearer '+owner;
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await worker.fetch(new Request('https://vault.grandelement.com'+path,{
  method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})
 }),env);
 return {http:response.status,data:await response.json()};
}
const admin='/v1/admin/access-codes',redeem='/v1/public/access/redeem';
let r=await call('/health');
assert.equal(r.http,200,JSON.stringify(r.data));
assert.equal(rows.size,0,'Health must not issue or grant LOVE automatically');
r=await call(admin);
assert.equal(r.http,401,'Anonymous visitor cannot manage access codes');
r=await call(redeem,{code:'LOVE',scope:'radio'});
assert.equal(r.http,403,'LOVE has no rights until the owner issues a D1 record');
r=await call(admin,undefined,true);
assert.equal(r.http,200);
assert.deepEqual(r.data.items,[],'Admin GET must not seed a special LOVE record');
const payload={action:'issue',label:'LOVE',requested_code:'LOVE',
 scopes:['radio'],duration_mode:'none',max_uses:0};
r=await call(admin,payload,true);
assert.equal(r.http,200,JSON.stringify(r.data));
assert.equal(r.data.code,'LOVE');
const codeId=r.data.id;
assert.match(codeId,/^access_[0-9a-f-]{36}$/);
assert.equal(rows.size,1);
assert.equal(rows.get(codeId).code_hash,createHmac('sha256',key).update('ge-access-v1:LOVE').digest('hex'));
r=await call(admin,payload,true);
assert.equal(r.http,409,'Duplicate code must not create another credential');
assert.equal(r.data.code_exists,true);
assert.equal(r.data.existing_id,codeId,'Owner may load and explicitly edit the same saved record');
assert.equal(rows.size,1,'Duplicate issue cannot replace or revoke a saved code');
r=await call(admin,undefined,true);
assert.equal(r.http,200);
assert.equal(r.data.items.length,1);
assert.deepEqual(r.data.items[0].scopes,['radio'],'LOVE must get only owner-selected scopes');
r=await call(redeem,{code:'LoVe',scope:'radio'});
assert.equal(r.http,200,JSON.stringify(r.data));
r=await call(redeem,{code:'LOVE',scope:'music'});
assert.equal(r.http,403,'LOVE does not bypass its selected permissions');
r=await call(admin,{action:'reveal',id:codeId},true);
assert.equal(r.http,200,JSON.stringify(r.data));
assert.equal(r.data.code,'LOVE','LOVE uses normal encrypted stored-secret retrieval');
r=await call(admin,{action:'edit',id:codeId,label:'LOVE',
 scopes:['radio','music'],duration_mode:'none',max_uses:0,
 playlist_ids:[],track_paths:[]},true);
assert.equal(r.http,200,JSON.stringify(r.data));
r=await call(admin,undefined,true);
assert.deepEqual(r.data.items[0].scopes,['radio','music'],
 'The Back Room can modify LOVE permissions on its existing record');
r=await call('/v1/public/access/music-session',{action:'redeem',code:'LOVE'});
assert.equal(r.http,200,JSON.stringify(r.data));
assert.ok(r.data.token,'Normal LOVE code gets a signed Music session only when allowed');
assert.ok(audits>=3);
assert.doesNotMatch(source,/row\.id==="access_legacy_love_v1"|code==="LOVE" \|\|/,
 'No LOVE-only backend allow/deny bypass may remain');
console.log('PASS: LOVE is owner-issued, normally hashed, stored encrypted, scoped, editable and never auto-granted.');
