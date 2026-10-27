import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const js=await readFile(new URL('../backroom/publisher-worker.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;
let internalCalls=0,publicCalls=0,adminReads=0,adminWrites=0;
const internalVault={async fetch(req){
 internalCalls++;
 assert.ok(req instanceof Request,'the internal binding forwards a Request');
 const url=new URL(req.url);
 if(url.pathname==='/health')return Response.json({
   ok:true,storage:'READY',access_codes_ready:true
 });
 assert.equal(req.redirect,'manual','Cloudflare Workers rejects redirect:error during Request construction');
 assert.equal(url.pathname,'/v1/admin/access-codes');
 assert.equal(req.headers.get('Authorization'),'Bearer SCOPED_INTERNAL_ONLY');
 if(req.method==='POST'){
   const payload=await req.json();
   assert.ok(['reveal','rotate'].includes(payload.action),'owner key commands must be explicitly allowed');
   assert.equal(payload.id,'access_legacy_love_v1');
   adminWrites++;
   return Response.json({ok:true,id:payload.id,action:payload.action,code:payload.action==='reveal'?'LOVE':'GE-TEST-SECURE-RESET'});
 }
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
 // Prove health of the REAL, authorized list operation without exposing records.
 r=await worker.fetch(request('/health?diagnose=access-codes'),env);
 assert.equal(r.status,200,'authenticated Vault list must be readable through Publisher');
 d=await r.json();
 assert.equal(d.access_codes_readable,true);
 assert.equal(d.upstream_http_status,200);
 assert.equal('items' in d,false,'public health must never leak private codes');
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
 assert.equal(adminReads,2,'one health probe and one signed-in listing');
 // Both owner-only commands must cross the Back Room Publisher and reach
 // the existing Vault access-code admin endpoint. A source-only allowlist
 // check is not sufficient: exercise the actual signed-in HTTP path.
 for(const action of ['reveal','rotate']){
   const payload={action,id:'access_legacy_love_v1'};
   r=await worker.fetch(request('/manage/access-codes',{
     method:'POST',headers:{Authorization:'Bearer '+login.token,'Content-Type':'application/json'},
     body:JSON.stringify(payload)
   }),env);
   d=await r.json();
   assert.equal(r.status,200,'Publisher must forward '+action+': '+JSON.stringify(d));
   assert.equal(d.action,action);
   assert.equal(d.id,payload.id);
   assert.ok(d.code,'Vault must return the owner-only access key');
 }
 assert.equal(adminWrites,2,'both privileged key commands reached bound Vault');
 r=await worker.fetch(request('/manage/access-codes',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'reveal',id:'access_legacy_love_v1'})
 }),env);
 assert.equal(r.status,401,'anonymous key reveal remains denied');
 assert.equal(publicCalls,0,'production Vault management must never use blocked public fetch');
 const withoutBinding={...env,GE_VAULT:undefined};
 r=await worker.fetch(request('/health'),withoutBinding);
 d=await r.json();
 assert.equal(d.vault_service_bound,false);
 assert.equal(d.vault_reachable,false);
 console.log('PASS: bound Vault health/D1 readiness, owner login, LOVE listing and private reveal/rotate, zero external fetches, missing-binding diagnosis');
}finally{globalThis.fetch=originalFetch;}
