import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const js=await readFile(new URL('../backroom/publisher-worker.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;
let internalCalls=0,publicCalls=0,adminReads=0;
const internalVault={async fetch(req){
 internalCalls++;
 assert.ok(req instanceof Request,'the internal binding forwards a Request');
 const url=new URL(req.url);
 if(url.pathname==='/health')return Response.json({
   ok:true,storage:'READY',access_codes_ready:true
 });
 assert.equal(url.pathname,'/v1/admin/access-codes');
 assert.equal(req.headers.get('Authorization'),'Bearer SCOPED_INTERNAL_ONLY');
 adminReads++;
 return Response.json({ok:true,master_enabled:true,items:[{
   id:'access_legacy_love_v1',label:'LOVE · Original Radio Gate',
   code_hint:'LOVE',scopes:['radio'],enabled:true,revoked:false
 }]});
}};
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{publicCalls++;throw Error('PUBLIC VAULT URL IS BLOCKED BY CLOUDFLARE');};
const base='https://ge-backroom-publisher.grandelement.workers.dev';
const env={BACKROOM_PASSWORD:'TEST_OWNER',SESSION_SECRET:'TEST_SESSION_SECRET',
 GITHUB_TOKEN:'TEST_GITHUB',VAULT_ACCESS_CODES_TOKEN:'SCOPED_INTERNAL_ONLY',
 GE_VAULT:internalVault};
try{
 const request=(path,init={})=>new Request(base+path,{
  ...init,headers:{Origin:'https://grandelement.com',...(init.headers||{})}
 });
 let r=await worker.fetch(request('/health'),env);
 assert.equal(r.status,200);
 let d=await r.json();
 assert.equal(d.vault_service_bound,true);
 assert.equal(d.vault_reachable,true);
 assert.equal(d.vault_access_codes_ready,true);
 assert.equal(d.access_codes_bridge_configured,true);
 r=await worker.fetch(request('/manage/access-codes'),env);
 assert.equal(r.status,401,'anonymous users cannot list access codes');
 r=await worker.fetch(request('/login',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({password:'TEST_OWNER'})}),env);
 assert.equal(r.status,200);
 const login=await r.json();
 assert.ok(login.token);
 r=await worker.fetch(request('/manage/access-codes',{
   headers:{Authorization:'Bearer '+login.token}}),env);
 d=await r.json();
 assert.equal(r.status,200,JSON.stringify(d));
 assert.deepEqual(d.items.map(x=>x.label),['LOVE · Original Radio Gate']);
 assert.equal(adminReads,1);
 assert.equal(publicCalls,0,'production Vault management must never use blocked public fetch');
 const withoutBinding={...env,GE_VAULT:undefined};
 r=await worker.fetch(request('/health'),withoutBinding);
 d=await r.json();
 assert.equal(d.vault_service_bound,false);
 assert.equal(d.vault_reachable,false);
 console.log('PASS: bound Vault health/D1 readiness, owner login, protected LOVE listing, zero external fetches, missing-binding diagnosis');
}finally{globalThis.fetch=originalFetch;}
