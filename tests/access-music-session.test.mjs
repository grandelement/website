import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac,webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const js=await readFile(new URL('../vault-worker/src/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const secret='ge-music-test-key-not-for-production';
const code='GE-ABC123DE45678';
const hash=createHmac('sha256',secret).update('ge-access-v1:ABC123DE45678').digest('hex');
const song='ge-music/music/Grand Element - 2005 - Fundamental Groove/Fundamental Groove_01_Intro.mp3';
const different='ge-music/music/Grand Element - 2024 - Fire/Fire_06_Smoke.mp3';
let row={id:'access_15bb9a8b-6086-4cda-a6ad-8df0a26b358a',code_hash:hash,label:'Authorized Fan',
  enabled:1,revoked_at:null,deleted_at:null,scopes_json:JSON.stringify(['music']),
  playlist_ids_json:'[]',track_paths_json:JSON.stringify([song]),
  duration_mode:'first_use',duration_seconds:86400,first_used_at:null,expires_at:null,
  max_uses:1,use_count:0};
let policy={enabled:1},auditCount=0;
const db={
  prepare(sql){
    let params=[];
    return {
      bind(...args){params=args;return this;},
      async first(){
        if(sql.includes('FROM access_code_policy'))return {...policy};
        if(sql.includes('FROM access_codes a')){
          if((sql.includes('a.code_hash=?')&&params[0]===row.code_hash)||
             (sql.includes('a.id=?')&&params[0]===row.id))return {...row};
          return null;
        }
        throw Error('Unexpected SELECT: '+sql);
      },
      async run(){
        if(sql.includes('UPDATE access_codes')){
          if(!row.enabled||row.revoked_at||row.deleted_at||row.use_count>=row.max_uses)return {meta:{changes:0}};
          row.use_count++;
          row.first_used_at??=params[0];row.expires_at??=params[1];
          return {meta:{changes:1}};
        }
        if(sql.includes('INSERT INTO audit_log')){auditCount++;return {meta:{changes:1}}}
        throw Error('Unexpected write: '+sql);
      }
    };
  }
};
const env={VAULT_DB:db,VAULT_HASH_KEY:secret,ALLOWED_ORIGINS:'https://grandelement.com'};
async function call(body){
  const req=new Request('https://vault.grandelement.com/v1/public/access/music-session',{
    method:'POST',headers:{'Content-Type':'application/json','Origin':'https://grandelement.com'},
    body:JSON.stringify(body)
  });
  const response=await worker.fetch(req,env);
  return {status:response.status,json:await response.json()};
}
let result=await call({action:'redeem',code});
assert.equal(result.status,200,JSON.stringify(result.json));
assert.equal(result.json.ok,true);
assert.equal(result.json.restricted,true);
assert.deepEqual(result.json.allowed_tracks,[song]);
assert.equal(row.use_count,1);
const token=result.json.token;
assert.equal(token.split('.').length,4);
result=await call({action:'verify',token,track_path:song});
assert.equal(result.status,200,JSON.stringify(result.json));
assert.equal(result.json.authorized,true);
assert.equal(row.use_count,1,'verification cannot consume a code use');
result=await call({action:'verify',token,track_path:different});
assert.equal(result.status,403,'a restricted code cannot play an unauthorized song');
result=await call({action:'verify',token:token.slice(0,-1)+'x',track_path:song});
assert.equal(result.status,403,'tampered session rejected');
result=await call({action:'redeem',code});
assert.equal(result.status,403,'redemption must honor max uses');
row.revoked_at=Math.floor(Date.now()/1000);
result=await call({action:'verify',token,track_path:song});
assert.equal(result.status,403,'revoke must invalidate active sessions immediately');
row.revoked_at=null;
row.scopes_json=JSON.stringify(['radio']);
result=await call({action:'verify',token,track_path:song});
assert.equal(result.status,403,'Radio-only codes cannot access Music');
row.scopes_json=JSON.stringify(['music']);
policy.enabled=0;
result=await call({action:'verify',token,track_path:song});
assert.equal(result.status,403,'master switch must disable active Music sessions');
policy.enabled=1;
assert.equal(auditCount,1,'exactly one music redemption logged');
console.log('PASS: scoped Music code redemption, authorized track, unauthorized track, tamper, use limit, revoke, scope isolation, master disable');
