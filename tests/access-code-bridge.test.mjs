import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const code=async file=>(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const load=async file=>(await import('data:text/javascript;base64,'+Buffer.from(await code(file)).toString('base64'))).default;
const publisher=await load('backroom/publisher-worker.js');
const vault=await load('vault-worker/src/index.js');
let enabled=1,dbReads=0,dbWrites=0,upstreamCalls=0;
const db={prepare(sql){
 let params=[];
 return{bind(...a){params=a;return this},
  async first(){
   if(sql.includes('access_code_policy'))return {enabled};
   throw Error('Unexpected SELECT '+sql);
  },
  async all(){
   if(sql.includes('FROM access_codes')){dbReads++;return {results:[]}};
   throw Error('Unexpected list '+sql);
  },
  async run(){
   if(sql.includes('INSERT INTO access_code_policy')){enabled=Number(params[0]);dbWrites++;return {meta:{changes:1}}}
   if(sql.includes('INSERT INTO audit_log'))return {meta:{changes:1}};
   throw Error('Unexpected write '+sql);
  }
 }
}};
const vaultEnv={VAULT_DB:db,VAULT_ACCESS_CODES_TOKEN:'TEST_SCOPED_ACCESS_ONLY_0123456789abcdefgh',
 VAULT_ADMIN_TOKEN:'UNRELATED_OLD_ADMIN_SECRET',ALLOWED_ORIGINS:'https://grandelement.com'};
const originalFetch=globalThis.fetch;
globalThis.fetch=async (resource,init={})=>{
 const url=typeof resource==='string'?resource:resource.url;
 if(!url.startsWith('https://vault.grandelement.com/'))throw Error('unexpected upstream '+url);
 upstreamCalls++;
 const req=new Request(url,{method:init.method||'GET',headers:init.headers,
   ...(init.body?{body:init.body}:{})});
 return vault.fetch(req,vaultEnv);
};
try{
 const backroomEnv={BACKROOM_PASSWORD:'TEST_PASS',SESSION_SECRET:'TEST_LONG_SECRET',
 GITHUB_TOKEN:'dummy-github',VAULT_ACCESS_CODES_TOKEN:vaultEnv.VAULT_ACCESS_CODES_TOKEN};
 const url='https://ge-backroom-publisher.grandelement.workers.dev';
 const request=(path,init={})=>new Request(url+path,{
   ...init,headers:{Origin:'https://grandelement.com',...(init.headers||{})}
 });
 let resp=await publisher.fetch(request('/health'),backroomEnv);
 assert.equal(resp.status,200);
 let body=await resp.json();
 assert.equal(body.access_codes_bridge_configured,true);
 resp=await publisher.fetch(request('/manage/access-codes'),backroomEnv);
 assert.equal(resp.status,401,'owner must log in');
 resp=await publisher.fetch(request('/login',{method:'POST',
    body:JSON.stringify({password:'TEST_PASS'}),headers:{'Content-Type':'application/json'}}),backroomEnv);
 assert.equal(resp.status,200);const login=await resp.json();
 assert.ok(login.token,'publisher login token');
 const auth={'Authorization':'Bearer '+login.token};
 resp=await publisher.fetch(request('/manage/access-codes',{headers:auth}),backroomEnv);
 body=await resp.json();
 assert.equal(resp.status,200,JSON.stringify(body));
 assert.deepEqual(body.items,[]);
 assert.equal(dbReads,1);
 resp=await publisher.fetch(request('/manage/access-codes',{method:'POST',
   headers:{...auth,'Content-Type':'application/json'},
   body:JSON.stringify({action:'master',enabled:false})}),backroomEnv);
 body=await resp.json();
 assert.equal(resp.status,200,JSON.stringify(body));
 assert.equal(body.master_enabled,false);
 assert.equal(dbWrites,1);
 assert.equal(upstreamCalls,2);
 const wrongReq=new Request('https://vault.grandelement.com/v1/admin/access-codes',
   {headers:{Authorization:'Bearer WRONG'},method:'GET'});
 resp=await vault.fetch(wrongReq,vaultEnv);
 assert.equal(resp.status,401,'untrusted requests cannot administer access codes');
 const otherReq=new Request('https://vault.grandelement.com/v1/admin/summary',
   {headers:{Authorization:'Bearer '+vaultEnv.VAULT_ACCESS_CODES_TOKEN},method:'GET'});
 resp=await vault.fetch(otherReq,vaultEnv);
 assert.equal(resp.status,401,'scoped bridge token cannot access analytics');
 const withoutBridge={...backroomEnv,VAULT_ACCESS_CODES_TOKEN:undefined};
 resp=await publisher.fetch(request('/manage/access-codes',{headers:auth}),withoutBridge);
 assert.equal(resp.status,503,'missing bridge should clearly fail, not fake an empty list');
 console.log('PASS: publisher login, private GET and POST to Vault, no-token failure, wrong token denial, limited scope and safe readiness');
}finally{globalThis.fetch=originalFetch}
