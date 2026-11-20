// End-to-end mock of GitHub App token recovery, owner-only canary write
// and exact readback. No network, owner secret or live GitHub file is used.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto,generateKeyPairSync} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const workerSource=await readFile('backroom/publisher-worker.js','utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'))).default;
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=privateKey.export({format:'pem',type:'pkcs1'}).toString();
const env={
 BACKROOM_PASSWORD:'unit-test-owner',SESSION_SECRET:'long-valid-session-secret',
 GITHUB_APP_ID:'5831659',GITHUB_APP_INSTALLATION_ID:'111',
 GITHUB_APP_PRIVATE_KEY:pem,GITHUB_OWNER:'grandelement',
 GITHUB_REPO:'website',GITHUB_BRANCH:'main'
};
const host='https://ge-backroom-publisher.grandelement.workers.dev';
const req=(path,opts={})=>new Request(host+path,{
 ...opts,headers:{Origin:'https://grandelement.com','Content-Type':'application/json',...(opts.headers||{})}
});
let saved=null,writeCount=0,lookupCount=0,oldIdAttempts=0,newIdAttempts=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
 const u=String(url),method=init.method||'GET';
 if(u.endsWith('/app/installations/111/access_tokens')){
  oldIdAttempts++;
  return Response.json({message:'Not Found'},{status:404});
 }
 if(u.endsWith('/repos/grandelement/website/installation')){
  lookupCount++;
  return Response.json({id:222,app_id:5831659});
 }
 if(u.endsWith('/app/installations/222/access_tokens')){
  newIdAttempts++;
  return Response.json({token:'mock-app-only-token',
   expires_at:new Date(Date.now()+60*60*1000).toISOString()},{status:201});
 }
 if(!String(init.headers?.Authorization||'').includes('mock-app-only-token'))
  throw Error('GitHub data endpoints must use the App installation token');
 if(u.includes('/contents/config/site-live.json')){
  assert.equal(method,'GET');
  return Response.json({sha:'safe-live-sha',
   content:Buffer.from(JSON.stringify({welcome:{},albums:{},games:{}})).toString('base64')});
 }
 if(u.includes('/contents/config/backroom-github-connection-check.json')){
  if(method==='GET')
   return saved===null
    ?Response.json({message:'Not Found'},{status:404})
    :Response.json({sha:'canary-sha',content:Buffer.from(saved).toString('base64')});
  if(method==='PUT'){
   const body=JSON.parse(init.body);
   assert.equal(body.branch,'main');
   assert.match(body.message,/Verify Back Room GitHub App/);
   assert.equal(body.sha,undefined,'First write must create isolated canary');
   saved=Buffer.from(body.content,'base64').toString('utf8');
   writeCount++;
   return Response.json({commit:{sha:'verified-write-commit'},content:{sha:'canary-sha'}});
  }
 }
 throw Error('Unexpected GitHub API request: '+method+' '+u);
};
try{
 let response=await worker.fetch(req('/manage/github-write-verify',{method:'POST'}),env);
 assert.equal(response.status,401,'Anonymous caller cannot trigger GitHub writes');
 response=await worker.fetch(req('/login',{method:'POST',body:JSON.stringify({password:'unit-test-owner'})}),env);
 assert.equal(response.status,200);
 const {token}=await response.json();
 const authorization={Authorization:'Bearer '+token};
 response=await worker.fetch(req('/manage/github-health',{headers:authorization}),env);
 assert.equal(response.status,200,'App-only GitHub read must succeed after installation recovery');
 const health=await response.json();
 assert.equal(health.app_read_verified,true,'Legacy PAT must never be required');
 response=await worker.fetch(req('/manage/github-write-verify',{method:'POST',headers:authorization}),env);
 assert.equal(response.status,200,await response.clone().text());
 const proof=await response.json();
 assert.equal(proof.app_only,true);
 assert.equal(proof.readback_verified,true);
 assert.equal(proof.commit,'verified-write-commit');
 assert.equal(writeCount,1,'Must perform a real write exactly once');
 assert.ok(JSON.parse(saved).marker,'Canary must contain a unique marker');
 response=await worker.fetch(req('/manage/github-write-verify',{method:'POST',headers:authorization}),env);
 const second=await response.json();
 assert.equal(response.status,200);
 assert.equal(second.previous,true,'Avoid GitHub commits on every owner login');
 assert.equal(writeCount,1,'Recent valid canary must be read back without another write');
 assert.equal(oldIdAttempts,1,'First use must diagnose wrong installation ID');
 assert.equal(lookupCount,1,'Use JWT to discover current repo installation');
 assert.equal(newIdAttempts,1,'Recovered installation must issue an App-only token');
 console.log('PASS: stale GitHub installation ID auto-recovers; owner-only App write, readback, and throttling verified.');
}finally{
 globalThis.fetch=originalFetch;
}
