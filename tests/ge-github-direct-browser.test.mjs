import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';

const html=readFileSync('backroom/github-direct.html','utf8');
const code=readFileSync('backroom/github-direct.js','utf8');
const config=JSON.parse(readFileSync('config/site-live.json','utf8'));
const manifest=JSON.parse(readFileSync('radio/manifest.json','utf8'));
const registry=JSON.parse(readFileSync('playlists/registry.json','utf8'));
const CRED='GE_DIRECT_GITHUB_ENCRYPTED_CREDENTIAL_V1';
const DRAFT='GE_DIRECT_GITHUB_MUSIC_DRAFT_V1';
assert.ok(!code.includes('workers.dev'),'Direct publisher must not depend on Cloudflare');
assert.ok(html.includes("script-src 'self'"),'Direct publisher must deny third-party JavaScript');
assert.ok(html.includes("connect-src 'self' https://api.github.com"),'Direct publisher network allowlist missing');
assert.ok(code.includes("localStorage.setItem(CREDENTIAL_KEY,encrypted)"),'Only encrypted credential may be stored');
assert.ok(!/localStorage\.setItem\(\s*CREDENTIAL_KEY\s*,\s*(?:token|secret|unlockedToken)\s*\)/.test(code),'Do not store token in plaintext');
assert.ok(code.includes("const secret=unlockedToken;"),'SAVE must use unlocked memory credential');
assert.ok(code.includes('if(!same(live,base))'),'Must reject concurrent GitHub changes');
assert.ok(code.includes('const read=await githubGet(secret)'),'Must verify write from GitHub');
assert.ok(!html.includes('id="token"'),'No token input on normal save screen');

const pageHtml=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'')
 .replace(/<script defer src="\.\/github-direct\.js[^"]*"><\/script>/,'');
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox']
});
try{
 const page=await browser.newPage();
 page.on('dialog',dialog=>void dialog.accept());
 await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 await page.setRequestInterception(true);
 page.on('request',request=>{
  if(request.url()==='http://localhost/backroom/github-direct.html')
   void request.respond({status:200,contentType:'text/html',body:pageHtml});
  else void request.abort();
 });
 await page.goto('http://localhost/backroom/github-direct.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(({config,manifest,registry})=>{
  window.__mock={initial:structuredClone(config),remote:structuredClone(config),manifest,registry,
   sha:'base-sha',putCount:0,tokenHeaderSeen:false,requested:[]};
  window.fetch=async (url,options={})=>{
   const u=String(url),state=window.__mock;
   state.requested.push(u);
   if(u.startsWith('../config/site-live.json'))return new Response(JSON.stringify(state.initial),{status:200});
   if(u.startsWith('../radio/manifest.json'))return new Response(JSON.stringify(state.manifest),{status:200});
   if(u.startsWith('../playlists/registry.json'))return new Response(JSON.stringify(state.registry),{status:200});
   if(u==='https://api.github.com/repos/grandelement/website/contents/radio/manifest.json?ref=main'||
      u==='https://api.github.com/repos/grandelement/website/contents/playlists/registry.json?ref=main'){
    const data=u.includes('/radio/manifest.json')?state.manifest:state.registry;
    const bytes=new TextEncoder().encode(JSON.stringify(data));
    const text=btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
    return new Response(JSON.stringify({sha:'inventory-sha',content:text}),{status:200});
   }
   if(u==='https://api.github.com/repos/grandelement/website/contents/config/site-live.json?ref=main'){
    state.tokenHeaderSeen=String(options.headers?.Authorization||'').startsWith('Bearer github_pat_');
    const bytes=new TextEncoder().encode(JSON.stringify(state.remote));
    const text=btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
    return new Response(JSON.stringify({sha:state.sha,content:text}),{status:200});
   }
   if(u==='https://api.github.com/repos/grandelement/website/contents/config/site-live.json'&&options.method==='PUT'){
    const payload=JSON.parse(options.body);
    if(payload.sha!==state.sha)throw Error('Incorrect expected GitHub SHA');
    const bytes=Uint8Array.from(atob(payload.content),c=>c.charCodeAt(0));
    state.remote=JSON.parse(new TextDecoder().decode(bytes));
    state.sha='new-sha';state.putCount++;
    return new Response(JSON.stringify({commit:{sha:'abc123456789test'}}),{status:200});
   }
   throw Error('Unexpected network request: '+u);
  };
 },{config,manifest,registry});
 await page.addScriptTag({content:code});
 const initial=await page.evaluate(()=>({
  secure:window.isSecureContext,crypto:!!crypto.subtle,
  setup:!document.getElementById('firstSetup').hidden,
  editor:document.getElementById('editor').hidden,
  stored:localStorage.getItem('GE_DIRECT_GITHUB_ENCRYPTED_CREDENTIAL_V1')
 }));
 assert.equal(initial.secure,true,'Passcode encryption requires secure browser context');
 assert.equal(initial.crypto,true,'Web Crypto must be available');
 assert.equal(initial.setup,true);
 assert.equal(initial.editor,true);
 assert.equal(initial.stored,null);

 // One-time setup stores only an encrypted credential and unlocks the controls.
 await page.$eval('#setupToken',e=>e.value='github_pat_TEST_SECRET');
 await page.$eval('#setupCode',e=>e.value='LongPasscode123');
 await page.$eval('#setupConfirm',e=>e.value='LongPasscode123');
 await page.click('#setupButton');
 await page.waitForFunction(()=>
  !document.getElementById('editor').hidden&&
  document.getElementById('counts').textContent.includes('105 FILES'),
  {timeout:30000});
 const enrolled=await page.evaluate(()=>({
  encrypted:localStorage.getItem('GE_DIRECT_GITHUB_ENCRYPTED_CREDENTIAL_V1'),
  setupToken:document.getElementById('setupToken').value,
  count:document.getElementById('counts').textContent
 }));
 assert.ok(enrolled.encrypted&&enrolled.encrypted.length>100);
 assert.ok(!enrolled.encrypted.includes('github_pat_TEST_SECRET'),'Plaintext token leaked into storage');
 assert.equal(enrolled.setupToken,'');
 assert.match(enrolled.count,/51 RADIO SONGS/);
 assert.equal(await page.$eval('#save',e=>e.disabled),true);

 // One-click save must work without requesting another token or another password.
 await page.$eval('#songs .songRow:not(.columnLegend) label:last-child input:not(:checked)',e=>e.click());
 await page.waitForFunction(()=>!document.getElementById('save').disabled);
 await page.click('#save');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('SAVED AND VERIFIED ON GITHUB'),{timeout:15000});
 const saved=await page.evaluate(()=>({
  count:window.__mock.putCount,remote:window.__mock.remote,tokenHeaderSeen:window.__mock.tokenHeaderSeen,
  localDraft:localStorage.getItem('GE_DIRECT_GITHUB_MUSIC_DRAFT_V1'),
  encrypted:localStorage.getItem('GE_DIRECT_GITHUB_ENCRYPTED_CREDENTIAL_V1'),
  requests:window.__mock.requested
 }));
 assert.equal(saved.count,1);
 assert.equal(saved.tokenHeaderSeen,true);
 assert.equal(saved.localDraft,null);
 assert.equal(saved.encrypted,enrolled.encrypted,'No encryption key update during normal save');
 assert.equal(saved.remote.music.radioMasterSongPaths.length,52);
 assert.equal(saved.remote.music.catalogRouting.playerSongPaths.length,105);
 assert.deepEqual(saved.remote.music.publicDJPlaylistNames,config.music.publicDJPlaylistNames);
 assert.deepEqual(saved.remote.welcome,config.welcome);
 assert.equal(saved.requests.some(url=>url.includes('workers.dev')),false);

 // Lock, reject incorrect passcode, then unlock with the one passcode and no token.
 await page.click('#lockPublisher');
 assert.equal(await page.$eval('#editor',e=>e.hidden),true);
 assert.equal(await page.$eval('#unlockAccess',e=>e.hidden),false);
 await page.$eval('#unlockCode',e=>e.value='WrongPasscode123');
 await page.click('#unlockButton');
 await page.waitForFunction(()=>document.getElementById('authStatus').textContent.includes('UNLOCK FAILED'),{timeout:12000});
 assert.equal(await page.$eval('#editor',e=>e.hidden),true);
 await page.evaluate(()=>{window.__mock.initial=structuredClone(window.__mock.remote)});
 await page.$eval('#unlockCode',e=>e.value='LongPasscode123');
 await page.click('#unlockButton');
 await page.waitForFunction(()=>!document.getElementById('editor').hidden&&
  document.getElementById('counts').textContent.includes('105 FILES'),{timeout:20000});
 assert.equal(await page.$eval('#unlockCode',e=>e.value),'');
 assert.equal(await page.$eval('#setupToken',e=>e.value),'');
 assert.equal(await page.$eval('#save',e=>e.disabled),true);

 // GitHub settings changed elsewhere: saved token must not bypass conflict guard.
 await page.$eval('#songs .songRow:not(.columnLegend) label:last-child input:checked',e=>e.click());
 await page.evaluate(()=>{window.__mock.remote.music.radioMasterSongPaths.pop()});
 await page.click('#save');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('NOT SAVED'),{timeout:15000});
 assert.equal(await page.evaluate(()=>window.__mock.putCount),1);
 assert.match(await page.$eval('#status',e=>e.textContent),/settings changed after you loaded/);
 assert.ok(await page.evaluate(DRAFT=>localStorage.getItem(DRAFT),DRAFT),'Local draft survived failed save');

 // Reset only the encrypted credential. Never remove the user's unsaved edits.
 await page.click('#lockPublisher');
 await page.click('#forgetDevice');
 assert.equal(await page.evaluate(CRED=>localStorage.getItem(CRED),CRED),null);
 assert.equal(await page.$eval('#firstSetup',e=>e.hidden),false);
 assert.ok(await page.evaluate(DRAFT=>localStorage.getItem(DRAFT),DRAFT));
 console.log('PASS: one-time encrypted GitHub credential, strong passcode unlock, wrong-code refusal, single-click save, mobile UI, no Cloudflare, verified readback, conflict and draft preservation.');
}finally{await browser.close()}
