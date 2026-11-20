// Regression: GitHub's downloaded PKCS#1 RSA PEM must sign a valid App JWT.
// Runs against the actual Worker implementation, without owner secrets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,createPublicKey,verify} from 'node:crypto';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const src=readFileSync('backroom/publisher-worker.js','utf8');
const begin=src.indexOf('async function githubAppJwt(env){');
const end=src.indexOf('\nasync function githubCredential(env){',begin);
assert(begin>=0&&end>begin,'GitHub App signing function must exist');
const enc=new TextEncoder();
const context={crypto:webcrypto,TextEncoder,Uint8Array,atob,Date,JSON,Error,Math};
vm.createContext(context);
vm.runInContext('const enc=new TextEncoder();const b64url=bytes=>Buffer.from(bytes).toString("base64url");',Object.assign(context,{Buffer}));
vm.runInContext(src.slice(begin,end)+';globalThis.signApp=githubAppJwt;',context);
for(const type of ['pkcs1','pkcs8']){
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const pem=privateKey.export({format:'pem',type});
  const jwt=await context.signApp({GITHUB_APP_ID:'5831659',GITHUB_APP_PRIVATE_KEY:pem});
  const [header,payload,signature]=jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'RS256');
  assert.equal(JSON.parse(Buffer.from(payload,'base64url')).iss,'5831659');
  assert(verify('RSA-SHA256',Buffer.from(header+'.'+payload),publicKey,Buffer.from(signature,'base64url')),type+' JWT signature must verify');
}
console.log('GitHub App PKCS#1 and PKCS#8 PEM signing verified');
