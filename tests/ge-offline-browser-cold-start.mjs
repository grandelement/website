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
  const offline=universe.querySelector('.geUniverseOfflineLaunch');
  const rect=offline.getBoundingClientRect();
  return {visible:getComputedStyle(universe).display!=='none'&&rect.width>40&&rect.height>=40,
   button:offline.textContent.trim(),view:window.GEMusicV5.state().view};
 });
 assert.equal(albumEntry.visible,true,'ALBUMS must expose an OFFLINE button on phone');
 assert.equal(albumEntry.button,'OFFLINE');
 assert.equal(albumEntry.view,'albums','MUSIC must open on ALBUMS by default');
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.geUniverseOfflineLaunch').click();
 });
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  const panel=root.querySelector('.window.geOfflineOpen .geOfflineWorkspace');
  return panel&&getComputedStyle(panel).display!=='none'&&
   getComputedStyle(root.querySelector('.window')).display!=='none';
 });
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.geOfflineBack').click();
 });
 await page.waitForFunction(()=>!!document.getElementById('geMusicV5Host').shadowRoot.querySelector('.geStandaloneAlbumUniverse.isActive'));
 // From SONGS, the shared MUSIC header must expose OFFLINE.
 await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('.geStandaloneAlbumUniverse').dispatchEvent(new MouseEvent('click',{bubbles:true}));
 });
 await page.waitForFunction(()=>window.GEMusicV5.state().view==='browse-songs');
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
 // Mock a locally verified listener grant in this test only; production uses GE Gate.
 const prepared=await page.evaluate(async path=>{
  window.GERadioOfflineBridge={
   canDownload:()=>true,allowedPaths:()=>[path],rescan:()=>Promise.resolve(),
   promptCode:()=>{}
  };
  const result=await window.GEOfflineDownloads.save({mode:'checked',paths:[path]});
  return {ready:result.ready,partial:result.partial,error:result.error,
   stations:result.stations,stationTotal:result.stationTotal,
   saved:result.saved,total:result.total};
 },song);
 assert.equal(prepared.error,undefined,'Download engine failed: '+JSON.stringify(prepared));
 assert.equal(prepared.ready,true,'Radio must verify saved audio, station IDs, app files and art');
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
 console.log('PASS offline Radio browser cold start, actual audio, station IDs, artwork, SUN LAB script, MUSIC progress');
}finally{
 await browser.close();
}
