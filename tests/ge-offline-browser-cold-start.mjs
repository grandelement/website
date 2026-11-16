// Chromium end-to-end OFFLINE verification, using the repository's real audio files.
// This is not a substitute for an actual iPhone Home Screen/Airplane Mode test.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const base='http://127.0.0.1:8765/radio/';
const song='ge-music/music/Grand Element - 2008 - Sessions I/Sessions I_08_Resurection.mp3';
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
page.setDefaultTimeout(75000);
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1');
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!!window.GEOfflineDownloads&&!!window.GEMusicV5?.open);
 // MUSIC must open ALBUMS, not the buried SONGS view shown on iPhone.
 await page.evaluate(()=>document.getElementById('geMusicV5Button').click());
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  return !!root?.querySelector('.geStandaloneAlbumUniverse.isActive');
 });
 const albumEntry=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  const universe=root.querySelector('.geStandaloneAlbumUniverse');
  const board=universe.querySelector('.geUniverseAlbums');
  const covers=[...board.querySelectorAll('.geUniverseAlbum')];
  const first=covers[0]?.getBoundingClientRect();
  return {visible:getComputedStyle(universe).display!=='none',
   hasToolbar:!!universe.querySelector('.geUniverseToolbar'),
   albums:covers.map(b=>b.dataset.album),
   large:!!first&&first.width>=200&&first.height>=200,
   scrolls:board.scrollHeight>board.clientHeight};
 });
 assert.equal(albumEntry.visible,true,'MUSIC must open on ALBUMS');
 assert.equal(albumEntry.hasToolbar,false,'No ALBUMS, OFFLINE, or BACK toolbar on artwork');
 assert.equal(albumEntry.large,true,'Album covers must be large and tappable');
 assert.equal(albumEntry.scrolls,true,'Album artwork stack must scroll rather than shrink to fit');
 assert.ok(albumEntry.albums.includes('Fire'));
 assert.ok(!albumEntry.albums.includes('Fundamental Groove'),'Marked final cover must be hidden only in the universe');
 // Radio keeps its original OFFLINE shortcut; this screen must not duplicate it.
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.geUniverseAlbum[data-album="Fire"]').click();
 });
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  return root?.querySelector('.albumDetailTitle')?.textContent==='Fire';
 });
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.albumDetailBack').click();
 });
 await page.waitForFunction(()=>!!document.getElementById('geMusicV5Host').shadowRoot.querySelector('.geStandaloneAlbumUniverse.isActive'));
 // From SONGS, the shared MUSIC header must expose OFFLINE.
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.geStandaloneAlbumUniverse').dispatchEvent(new MouseEvent('click',{bubbles:true}));
 });
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  return !!root?.querySelector('.window.geAlbumDetailClean .albumDetailSongs[aria-pressed="true"]');
 });
 const songEntry=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  const head=root.querySelector('.window.geAlbumDetailClean > .header');
  const button=head?.querySelector('.musicOfflineLaunch');
  const rect=button?.getBoundingClientRect();
  return {header:!!head&&getComputedStyle(head).display!=='none',
   offline:!!button&&getComputedStyle(button).display!=='none'&&rect.width>40};
 });
 assert.equal(songEntry.header,true,'SONGS must not hide the MUSIC header');
 assert.equal(songEntry.offline,true,'SONGS header must expose OFFLINE');
 await page.evaluate(()=>{
  document.getElementById('geMusicV5Host').shadowRoot.querySelector('.musicOfflineLaunch').click();
 });
 await page.waitForFunction(()=>!!document.getElementById('geMusicV5Host').shadowRoot.querySelector('.window.geOfflineOpen'));
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.geOfflineBack').click();
  root.querySelector('.close').click();
 });
 await page.waitForFunction(()=>!window.GEMusicV5.state().open);
 // Both entry buttons must reuse the one MUSIC shadow-root workspace.
 await page.evaluate(()=>document.getElementById('offlineLaunchBtn')?.click());
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  return !!root?.querySelector('.window.geOfflineOpen .geOfflineWorkspace');
 });
 const display=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  return {
   percent:root.querySelector('.geOfflinePercent')?.textContent,
   eta:root.querySelector('.geOfflineEta')?.textContent,
   progress:!!root.querySelector('progress.geOfflineProgress'),
   choices:[...root.querySelectorAll('[data-ge-offline]')].map(x=>x.dataset.geOffline),
   message:root.querySelector('.geOfflineStatus')?.textContent
  };
 });
 assert.equal(display.progress,true);
 assert.match(display.percent,/^\d+%$/);
 assert.match(display.eta,/^ETA:/);
 assert.deepEqual(display.choices,['all','checked','playlist','update']);
 assert.doesNotMatch(display.message||'',/\d+\s*\/\s*\d+|songs saved|files saved/i);
 // The verified worker must control the page and have a complete startup package.
 await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:65000});
 const shell=await page.evaluate(async()=>{
  const reg=await navigator.serviceWorker.getRegistration('./');
  const worker=reg?.active;
  if(!worker)return {ready:false,error:'No active offline worker'};
  const chan=new MessageChannel();
  return new Promise(resolve=>{
   const timer=setTimeout(()=>resolve({ready:false,error:'Status timed out'}),15000);
   chan.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data)};
   worker.postMessage({type:'GE_RADIO_SHELL_STATUS'},[chan.port2]);
  });
 });
 assert.equal(shell.ready,true,'Service worker required shell and artwork must pass: '+JSON.stringify(shell));
 // The reported failure: Safari on iPhone must not reject a download
 // solely because the page was not installed as a Home Screen icon.
 const safariTab=await page.evaluate(()=>!window.GEOfflineDownloads.installed());
 assert.equal(safariTab,true,'Test must execute in an ordinary Safari-like tab');
 // No valid code must be denied with a concrete message, without closing MUSIC.
 const denied=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.geOfflineStart').click();
  return {status:root.querySelector('.geOfflineStatus').textContent,
   visible:root.querySelector('.window').classList.contains('geOfflineOpen')};
 });
 assert.equal(denied.visible,true,'Denied OFFLINE attempt keeps the same download screen open');
 assert.match(denied.status,/OFFLINE permission/i);
 // Simulate only the existing Vault endpoint's signed response. Leave the
 // actual Radio access bridge, MUSIC code form and OFFLINE click handlers live.
 // Server grant enforcement has a separate test in access-music-session.test.mjs.
 await page.evaluate(path=>{
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,options)=>{
   const url=typeof input==='string'?input:input?.url||'';
   if(url==='https://vault.grandelement.com/v1/public/access/music-session'){
    const body=JSON.parse(options?.body||'{}');
    const success=body.action==='redeem'||
     (body.action==='verify'&&body.require_offline===true&&body.track_path===path);
    const response=body.action==='redeem'?
     {ok:true,token:'browser-qa-vault-signed-session',session_expires_at:Math.floor(Date.now()/1000)+3600,
      restricted:true,allowed_tracks:[path],playlist_ids:[],offline_enabled:true,display_name:'TEST CODE'}:
      {ok:success,authorized:success,offline_enabled:success,
       error:success?'':'OFFLINE not permitted'};
    return Promise.resolve(new Response(JSON.stringify(response),{
     status:success?200:403,headers:{'content-type':'application/json'}}));
   }
   return nativeFetch(input,options);
  };
 },song);
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.accessToggle').click();
 });
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  const form=root?.querySelector('.musicCodeTools');
  const input=root?.querySelector('.musicCodeInput');
  return !!form&&!form.hidden&&!!input&&input.getBoundingClientRect().height>0;
 });
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.musicCodeInput').value='QA-MOCK-VERIFIED-OFFLINE-CODE';
  root.querySelector('.musicCodeUnlock').click();
 });
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  return root?.querySelector('.window.geOfflineOpen .geOfflineWorkspace')&&
   window.GEOfflineDownloads?.canDownload()===true;
 },{timeout:15000});
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('[data-ge-offline="all"]').click();
  root.querySelector('.geOfflineStart').click();
 });
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  const status=root?.querySelector('.geOfflineStatus')?.textContent||'';
  return /^READY/.test(status)||/^PARTIAL/.test(status)||/^NOT READY/.test(status)&&/stopped|failed|error/i.test(status);
 },{timeout:120000});
 const prepared=await page.evaluate(async()=>{
  const result=await window.GEOfflineDownloads.inspect();
  return {ready:result.ready,partial:result.partial,error:result.error,
   stations:result.stations,stationTotal:result.stationTotal,
   saved:result.saved,total:result.total,
   display:document.getElementById('geMusicV5Host')?.shadowRoot?.querySelector('.geOfflineStatus')?.textContent};
 });
 assert.equal(prepared.error,undefined,'Download engine failed: '+JSON.stringify(prepared));
 assert.equal(prepared.ready,true,'Safari button must save real audio, station IDs, app files and art: '+JSON.stringify(prepared));
 assert.ok(prepared.stations>0&&prepared.stationTotal===prepared.stations);
 assert.equal(prepared.saved,1);
 // Simulate physical disconnection and cold browser navigation after caching.
 await page.setOfflineMode(true);
 await page.reload({waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForFunction(()=>!!window.GEOfflineDownloads,{timeout:20000});
 const result=await page.evaluate(async path=>{
  const check=await window.GEOfflineDownloads.inspect();
  const src=new URL('../'+path.split('/').map(encodeURIComponent).join('/'),location.href).href+'?ge_offline=1';
  const media=await fetch(src,{headers:{Range:'bytes=0-127'}});
  const audio=new Audio(src);
  audio.preload='auto';
  const decoded=await new Promise(resolve=>{
   const timer=setTimeout(()=>resolve({timeout:true}),12000);
   audio.onloadedmetadata=()=>{clearTimeout(timer);resolve({duration:audio.duration})};
   audio.onerror=()=>{clearTimeout(timer);resolve({error:audio.error?.code||'audio error'})};
   audio.load();
  });
  const image=await fetch('../ge-images/images/Grand%20Element%20-%20Aether.jpg');
  const spectrum=await fetch('./offline-spectrum.js');
  return {
   ready:check.ready,mediaStatus:media.status,mediaLength:(await media.arrayBuffer()).byteLength,
   imageStatus:image.status,spectrumStatus:spectrum.status,decoded
  };
 },song);
 assert.equal(result.ready,true,'Airplane Mode reload must remain READY');
 assert.equal(result.mediaStatus,206,'Saved audio range requests must work offline');
 assert.equal(result.mediaLength,128);
 assert.equal(result.imageStatus,200);
 assert.equal(result.spectrumStatus,200);
 assert.ok(Number(result.decoded.duration)>0,
  'Offline cached audio must decode and have a positive duration: '+JSON.stringify(result.decoded));
 console.log('PASS iPhone Safari-tab OFFLINE DOWNLOAD button, real audio, station IDs, art and cold offline playback');
}finally{
 await browser.close();
}
