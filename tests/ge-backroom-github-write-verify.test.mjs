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
 if(u==='https://api.github.com/app')return Response.json({id:5831659});
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
 const badPrivateKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'pem',type:'pkcs1'}).toString();
 globalThis.fetch=async(url)=>{
  const u=String(url);
  if(u.includes('/access_tokens'))return Response.json({message:'Bad credentials'},{status:401});
  if(u==='https://api.github.com/app')return Response.json({message:'Bad credentials'},{status:401});
  throw Error('Unexpected request during rejected JWT diagnosis: '+u);
 };
 const brokenEnv={...env,GITHUB_APP_PRIVATE_KEY:badPrivateKey};
 response=await worker.fetch(req('/manage/github-health',{headers:authorization}),brokenEnv);
 assert.equal(response.status,503,'Rejected App JWT must not report GitHub ready');
 const diagnostic=await response.json();
 assert.match(diagnostic.error,/GitHub rejected the signed App JWT \(HTTP 401\)/,
  'Expose the failing identity stage without exposing a secret');
 console.log('PASS: GitHub 401 is identified as a rejected App JWT, not an assumed Contents permission issue.');

 // GitHub may accept the public Client ID issuer when the numeric App ID
 // issuer is rejected. Recovery must still require a valid App JWT.
 appTokenCachePlaceholderUnused: {
  const clientEnv={...env,GITHUB_APP_INSTALLATION_ID:'444'};
  let numericIssuerAttempts=0,clientIssuerAttempts=0;
  globalThis.fetch=async(url,init={})=>{
   const u=String(url),auth=String(init.headers?.Authorization||'');
   if(u==='https://api.github.com/app'){
    const jwt=auth.slice('Bearer '.length);
    const payload=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));
    if(payload.iss==='5831659'){
     numericIssuerAttempts++;
     return Response.json({message:'Bad credentials'},{status:401});
    }
    if(payload.iss==='Iv23liIckQZ7XOLyGUQv'){
     clientIssuerAttempts++;
     return Response.json({id:5831659});
    }
    throw Error('Unexpected JWT issuer');
   }
   if(u.endsWith('/app/installations/444/access_tokens')){
    const jwt=auth.slice('Bearer '.length);
    const payload=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));
    return payload.iss==='Iv23liIckQZ7XOLyGUQv'
     ?Response.json({token:'client-issuer-token',expires_at:new Date(Date.now()+3600000).toISOString()},{status:201})
     :Response.json({message:'Bad credentials'},{status:401});
   }
   if(u.includes('/contents/config/site-live.json')){
    assert.equal(auth,'Bearer client-issuer-token');
    return Response.json({sha:'current-sha',content:Buffer.from(JSON.stringify({welcome:{},albums:{},games:{}})).toString('base64')});
   }
   throw Error('Unexpected Client ID fallback request: '+u);
  };
  response=await worker.fetch(req('/manage/github-health',{headers:authorization}),clientEnv);
  assert.equal(response.status,200,await response.clone().text());
  const recovered=await response.json();
  assert.equal(recovered.app_read_verified,true);
  assert.ok(numericIssuerAttempts>0,'Numeric issuer must be tested first');
  assert.ok(clientIssuerAttempts>0,'Client ID issuer fallback must be exercised');
  console.log('PASS: rejected numeric App issuer recovers through validated Client ID JWT.');
 }

 // The live Cloudflare App ID can be stale even when the public Client ID
 // authenticates the correct GE App; trust only the expected verified App.
 {
  const staleEnv={...env,GITHUB_APP_ID:'99999999',GITHUB_APP_INSTALLATION_ID:'555'};
  let installationChecked=false;
  globalThis.fetch=async(url,init={})=>{
   const target=String(url),auth=String(init.headers?.Authorization||'');
   const jwt=auth.startsWith('Bearer eyJ')?auth.slice(7):'';
   const issuer=jwt?JSON.parse(Buffer.from(jwt.split('.')[1],'base64url')).iss:'';
   if(target.endsWith('/app/installations/555/access_tokens'))
    return Response.json({message:'Bad credentials'},{status:401});
   if(target==='https://api.github.com/app')
    return issuer==='Iv23liIckQZ7XOLyGUQv'
     ?Response.json({id:5831659,client_id:'Iv23liIckQZ7XOLyGUQv'})
     :Response.json({message:'Bad credentials'},{status:401});
   if(target.endsWith('/repos/grandelement/website/installation')){
    installationChecked=true;
    return Response.json({id:666,app_id:5831659});
   }
   if(target.endsWith('/app/installations/666/access_tokens')){
    assert.equal(issuer,'Iv23liIckQZ7XOLyGUQv');
    return Response.json({token:'validated-app-token',expires_at:new Date(Date.now()+3600000).toISOString()},{status:201});
   }
   if(target.includes('/contents/config/site-live.json')){
    assert.equal(auth,'Bearer validated-app-token');
    return Response.json({sha:'live-test-sha',content:Buffer.from(JSON.stringify({welcome:{},albums:{},games:{}})).toString('base64')});
   }
   throw Error('Unexpected stale-id recovery endpoint: '+target);
  };
  response=await worker.fetch(req('/manage/github-health',{headers:authorization}),staleEnv);
  assert.equal(response.status,200,await response.clone().text());
  assert.equal((await response.json()).app_read_verified,true);
  assert.equal(installationChecked,true,'Must confirm repository installation belongs to authenticated App');
  console.log('PASS: stale numeric App ID recovers only for verified GE Client ID + App ID and matching repo installation.');
 }

 let dedicatedCount=0,adminCount=0;
 const vaultEnv={...env,
  VAULT_ACCESS_CODES_TOKEN:'stale-dedicated-bridge',
  VAULT_ADMIN_TOKEN:'current-full-admin-token',
  GE_VAULT:{fetch:async request=>{
   const auth=request.headers.get('Authorization');
   if(auth==='Bearer stale-dedicated-bridge'){
    dedicatedCount++;return Response.json({ok:false,error:'Unauthorized'},{status:401});
   }
   if(auth==='Bearer current-full-admin-token'){
    adminCount++;return Response.json({ok:true,items:[],master_enabled:true});
   }
   throw Error('Unknown Vault bridge credential');
  }}
 };
 response=await worker.fetch(req('/manage/access-codes',{headers:authorization}),vaultEnv);
 assert.equal(response.status,200,'Vault must try the configured full admin token after stale dedicated access token');
 const vault=await response.json();
 assert.equal(vault.ok,true);assert.deepEqual(vault.items,[]);
 assert.equal(dedicatedCount,1);assert.equal(adminCount,1);
 console.log('PASS: Vault falls back to existing authorized admin bridge when dedicated access token is rejected.');

}finally{
 globalThis.fetch=originalFetch;
}
