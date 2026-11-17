import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';

const html=readFileSync('backroom/github-direct.html','utf8');
const code=readFileSync('backroom/github-direct.js','utf8');
const config=JSON.parse(readFileSync('config/site-live.json','utf8'));
const manifest=JSON.parse(readFileSync('radio/manifest.json','utf8'));
const registry=JSON.parse(readFileSync('playlists/registry.json','utf8'));
assert.ok(!code.includes('workers.dev'),'Direct publisher must not depend on Cloudflare');
assert.ok(html.includes("script-src 'self'"),'Direct publisher must deny third-party JavaScript');
assert.ok(html.includes('connect-src \x27self\x27 https://api.github.com'),'Direct publisher network allowlist missing');
assert.ok(!/localStorage\.setItem\([^,]*(token|secret)/i.test(code),'Must not store GitHub token');
assert.ok(code.includes('if(!same(live,base))'),'Must reject concurrent GitHub changes');
assert.ok(code.includes('const read=await githubGet(secret)'),'Must verify write from GitHub');

const pageHtml=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'')
 .replace(/<script defer src="\.\/github-direct\.js[^"]*"><\/script>/,'');
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-setuid-sandbox']
});
try{
 const page=await browser.newPage();
 page.on('dialog',dialog=>void dialog.accept());
 await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 await page.setContent(pageHtml,{waitUntil:'domcontentloaded'});
 await page.evaluate(({config,manifest,registry})=>{
  window.__mock={initial:config,remote:structuredClone(config),manifest,registry,
   sha:'base-sha',putCount:0,tokenHeaderSeen:false,requested:[]};
  window.fetch=async (url,options={})=>{
   const u=String(url),state=window.__mock;
   state.requested.push(u);
   if(u.startsWith('../config/site-live.json'))return new Response(JSON.stringify(state.initial),{status:200});
   if(u.startsWith('../radio/manifest.json'))return new Response(JSON.stringify(state.manifest),{status:200});
   if(u.startsWith('../playlists/registry.json'))return new Response(JSON.stringify(state.registry),{status:200});
   if(u==='https://api.github.com/repos/grandelement/website/contents/config/site-live.json?ref=main'){
    state.tokenHeaderSeen=String(options.headers?.Authorization||'').startsWith('Bearer github_pat_');
    const bytes=new TextEncoder().encode(JSON.stringify(state.remote));
    const text=btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
    return new Response(JSON.stringify({sha:state.sha,content:text}),{status:200});
   }
   if(u==='https://api.github.com/repos/grandelement/website/contents/config/site-live.json'&&options.method==='PUT'){
    const payload=JSON.parse(options.body);
    assert.equal(payload.sha,state.sha);
    const bytes=Uint8Array.from(atob(payload.content),c=>c.charCodeAt(0));
    state.remote=JSON.parse(new TextDecoder().decode(bytes));
    state.sha='new-sha';state.putCount++;
    return new Response(JSON.stringify({commit:{sha:'abc123456789test'}}),{status:200});
   }
   throw Error('Unexpected network request: '+u);
  };
 },{config,manifest,registry});
 await page.addScriptTag({content:code});
 await page.waitForFunction(()=>document.getElementById('counts').textContent.includes('105 FILES'));
 assert.equal(await page.$eval('#save',n=>n.disabled),true,'No changes should be saved');
 const initial=await page.$eval('#counts',e=>e.textContent);
 assert.match(initial,/51 RADIO SONGS/);
 await page.$eval('.songRow:last-child input:last-child',e=>e.click());
 await page.waitForFunction(()=>!document.getElementById('save').disabled);
 await page.click('#save');
 assert.match(await page.$eval('#status',e=>e.textContent),/ENTER THE FINE-GRAINED GITHUB TOKEN/);
 await page.$eval('#token',e=>e.value='github_pat_TEST_SECRET');
 await page.click('#save');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('SAVED AND VERIFIED ON GITHUB'),{timeout:10000});
 const state=await page.evaluate(()=>({
  count:window.__mock.putCount,remote:window.__mock.remote,tokenHeaderSeen:window.__mock.tokenHeaderSeen,
  domToken:document.getElementById('token').value,
  localDraft:localStorage.getItem('GE_DIRECT_GITHUB_MUSIC_DRAFT_V1'),
  requests:window.__mock.requested
 }));
 assert.equal(state.count,1);
 assert.equal(state.tokenHeaderSeen,true);
 assert.equal(state.domToken,'');
 assert.equal(state.localDraft,null);
 assert.equal(state.remote.music.radioMasterSongPaths.length,52);
 assert.equal(state.remote.music.catalogRouting.playerSongPaths.length,105);
 assert.equal(state.remote.welcome.title,config.welcome.title);
 assert.deepEqual(state.remote.music.publicDJPlaylistNames,config.music.publicDJPlaylistNames);
 assert.equal(state.requests.some(url=>url.includes('workers.dev')),false);
 // A concurrent edit to the same routing file must prevent unsafe overwriting.
 await page.$eval('.songRow:last-child input:last-child',e=>e.click());
 await page.evaluate(()=>{window.__mock.remote.music.radioMasterSongPaths.pop()});
 await page.$eval('#token',e=>e.value='github_pat_TEST_SECRET');
 await page.click('#save');
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('NOT SAVED'),{timeout:10000});
 assert.equal(await page.evaluate(()=>window.__mock.putCount),1);
 assert.match(await page.$eval('#status',e=>e.textContent),/settings changed after you loaded/);
 assert.equal(await page.$eval('#token',e=>e.value),'');
 console.log('PASS: mobile direct GitHub save, readback verification, Cloudflare-free network, transient token, preserved unrelated settings, conflict protection.');
}finally{await browser.close()}
