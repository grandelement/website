import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const workerCode=await readFile(new URL('../backroom/publisher-worker.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(workerCode).toString('base64'))).default;
const backroom=await readFile(new URL('../backroom/index.html',import.meta.url),'utf8');
const homepage=await readFile(new URL('../index.html',import.meta.url),'utf8');

const original={
  version:1,mode:'live',welcome:{enabled:true},albums:{},games:{},
  music:{radioMasterSongPaths:['ge-music/music/safe-track.mp3'],catalogRouting:{keep:'separate'}},
  merchandise:{size:100,speed:100,rotation:100,direction:'normal',quantity:2},
  otherPublishedSetting:'MUST NOT BE ALTERED'
};
let config=structuredClone(original),putCount=0,sha='initial123';
const savedFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
  const target=String(url);
  if(!target.includes('/contents/config/site-live.json'))throw Error('Unexpected external fetch '+target);
  if(options.method==='PUT'){
    const payload=JSON.parse(options.body);
    if(payload.sha!==sha)return Response.json({message:'Conflict'},{status:409});
    config=JSON.parse(Buffer.from(payload.content,'base64').toString('utf8'));
    putCount++;sha='after-'+putCount;
    return Response.json({commit:{sha:'commit-'+putCount},content:{sha}});
  }
  return Response.json({sha,content:Buffer.from(JSON.stringify(config)).toString('base64')});
};
const origin='https://grandelement.com';
const base='https://ge-backroom-publisher.grandelement.workers.dev';
const env={BACKROOM_PASSWORD:'test-owner',SESSION_SECRET:'test-long-private-session',
  GITHUB_TOKEN:'test-github',GITHUB_OWNER:'grandelement',GITHUB_REPO:'website',GITHUB_BRANCH:'main'};
const request=(path,options={})=>new Request(base+path,{
  ...options,headers:{Origin:origin,'Content-Type':'application/json',...(options.headers||{})}
});
try {
  let response=await worker.fetch(request('/manage/merchandise'),env);
  assert.equal(response.status,401,'Anonymous cannot read the owner merchandise settings');
  response=await worker.fetch(request('/login',{method:'POST',
    body:JSON.stringify({password:'test-owner'})}),env);
  assert.equal(response.status,200);
  const {token}=await response.json();
  const headers={Authorization:'Bearer '+token};
  response=await worker.fetch(request('/manage/merchandise',{headers}),env);
  assert.equal(response.status,200);
  const first=await response.json();
  assert.deepEqual(first.merchandise,original.merchandise);

  const proposed={size:115,speed:250,rotation:0,direction:'reverse',quantity:1,
    entryDirection:'left',entryTiming:'fixed',entryMinSeconds:18,entryMaxSeconds:18};
  response=await worker.fetch(request('/manage/merchandise',{method:'POST',headers,
    body:JSON.stringify({merchandise:proposed,expectedMerchandise:first.merchandise})}),env);
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  const saved=await response.json();
  assert.equal(saved.commit,'commit-1');
  assert.deepEqual(config.merchandise,proposed);
  assert.deepEqual(config.music,original.music,'Radio and music config untouched');
  assert.equal(config.otherPublishedSetting,original.otherPublishedSetting);

  response=await worker.fetch(request('/manage/merchandise',{headers}),env);
  assert.deepEqual((await response.json()).merchandise,proposed,'Readback confirms every saved field');
  response=await worker.fetch(request('/manage/merchandise',{method:'POST',headers,
    body:JSON.stringify({merchandise:{...proposed,speed:999},
      expectedMerchandise:proposed})}),env);
  assert.equal(response.status,400,'Reject invalid speed without saving');
  response=await worker.fetch(request('/manage/merchandise',{method:'POST',headers,
    body:JSON.stringify({merchandise:{...proposed,speed:150},
      expectedMerchandise:original.merchandise})}),env);
  assert.equal(response.status,409,'Do not overwrite settings from another device');
  response=await worker.fetch(request('/manage/merchandise',{method:'POST',
    body:JSON.stringify({merchandise:proposed,expectedMerchandise:proposed})}),env);
  assert.equal(response.status,401,'Owner access always required for publishing');
  assert.equal(putCount,1,'Only one valid authenticated request made a GitHub commit');

  assert.ok(backroom.includes('id="brMerchSave"'));
  assert.ok(backroom.includes('id="brMerchReload"'));
  assert.ok(backroom.includes("api('/manage/merchandise'"));
  assert.match(homepage,/font-size:13px!important;line-height:1\.1!important;/);
  assert.match(homepage,/#sunWrap #btnMusic\.active\{background:transparent!important;\}/);
  assert.match(homepage,/--ge-merch-transit/);
  assert.match(homepage,/--ge-merch-hat-spin/);
  assert.match(homepage,/entryMinSeconds/);
  assert.match(homepage,/entryMaxSeconds/);
  console.log('PASS: owner-only merchandise save and readback; speed, size, rotation, direction, quantity and entrances; no radio/music overwrite; stale/unauthorized writes rejected; mobile label rules present.');
} finally {globalThis.fetch=savedFetch}
