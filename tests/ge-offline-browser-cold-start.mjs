// Chromium end-to-end OFFLINE verification, using the repository's real audio files.
// This is not a substitute for an actual iPhone Home Screen/Airplane Mode test.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const base='http://127.0.0.1:8765/radio/';
const song='ge-music/music/Grand Element - 2008 - Sessions I/Sessions I_08_Resurection.mp3';
const profile='/tmp/ge-radio-offline-profile-'+process.pid;
const launch=()=>puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,userDataDir:profile,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
let browser=await launch();
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
   fitted:!!first&&first.width>=35&&board.scrollHeight<=board.clientHeight+4,
   attached:covers.every((cover,i)=>i===0||
    Math.abs(cover.getBoundingClientRect().top-covers[i-1].getBoundingClientRect().bottom)<2),
   singleAbsent:!covers.some(b=>b.dataset.album==='Singles'),
   zoom:board.style.getPropertyValue('--ge-universe-zoom')};
 });
 assert.equal(albumEntry.visible,true,'MUSIC must open on ALBUMS');
 assert.equal(albumEntry.hasToolbar,false,'No ALBUMS, OFFLINE, or BACK toolbar on artwork');
 assert.equal(albumEntry.fitted,true,'All albums must fit on one screen by default');
 assert.equal(albumEntry.attached,true,'Album artwork edges must touch, with no gaps');
 assert.equal(albumEntry.singleAbsent,true,'Singles must not appear in album artwork');
 assert.equal(albumEntry.zoom,'1','The default album view must start zoomed out');
 const pinch=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  const board=root.querySelector('.geUniverseAlbums'),first=board.querySelector('.geUniverseAlbum');
  const before=first.getBoundingClientRect().width;
  board.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-400}));
  const after=first.getBoundingClientRect().width,scrolls=board.scrollHeight>board.clientHeight;
  board.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:2000}));
  return {before,after,scrolls,restored:first.getBoundingClientRect().width};
 });
 assert.ok(pinch.after>pinch.before*2&&pinch.scrolls,
  'Pinch zoom must enlarge and scroll all the real album covers: '+JSON.stringify(pinch));
 assert.ok(Math.abs(pinch.restored-pinch.before)<3,'Pinching inward restores the complete connected album view');
 assert.ok(albumEntry.albums.includes('Fire'));
 assert.ok(albumEntry.albums.includes('Fundamental Groove'),'Fundamental Groove remains visible in the universe by owner decision');
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
 // SONGS keeps the mini OFFLINE dock immediately above the existing
 // bottom Play / Buy controls. The album universe must stay artwork-only.
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
  const dock=root.querySelector('.geOfflineWorkspace'),toggle=root.querySelector('.geOfflineDockToggle');
  const footer=root.querySelector('.selectionBar'),headerButton=root.querySelector('.musicOfflineLaunch');
  const b=toggle.getBoundingClientRect(),f=footer.getBoundingClientRect(),d=dock.getBoundingClientRect();
  return {dock:!!dock&&getComputedStyle(dock).display!=='none',
   button:b.width>=60&&b.height>=35,aboveFooter:d.bottom<=f.top+3,
   headerHidden:getComputedStyle(headerButton).display==='none',
   footerVisible:f.height>0,choicesHidden:root.querySelector('.geOfflineChoices').hidden};
 });
 assert.equal(songEntry.dock,true,'Mini OFFLINE dock must be visible in SONGS');
 assert.equal(songEntry.button,true,'Single bottom OFFLINE button must be tappable');
 assert.equal(songEntry.aboveFooter,true,'OFFLINE dock sits directly above MUSIC bottom controls');
 assert.equal(songEntry.headerHidden,true,'There must not be another OFFLINE button in header');
 assert.equal(songEntry.footerVisible,true,'The PLAY/B﻿UY bottom row must remain visible');
 assert.equal(songEntry.choicesHidden,true,'Four choices stay collapsed when not needed');
 await page.evaluate(()=>document.getElementById('geMusicV5Host').shadowRoot.querySelector('.close').click());
 await page.waitForFunction(()=>!window.GEMusicV5.state().open);
 // The existing front-page OFFLINE shortcut uses the same inline MUSIC dock.
 await page.evaluate(()=>document.getElementById('offlineLaunchBtn')?.click());
 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  return !!root?.querySelector('.geOfflineWorkspace')&&!root.querySelector('.geOfflineChoices').hidden;
 });
 const display=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  return {
   percent:root.querySelector('.geOfflinePercent')?.textContent,
   eta:root.querySelector('.geOfflineEta')?.textContent,
   progress:!!root.querySelector('progress.geOfflineProgress'),
   choices:[...root.querySelectorAll('[data-ge-offline]')].map(x=>x.dataset.geOffline),
   optionsVisible:(()=>{
    const dock=root.querySelector('.geOfflineWorkspace').getBoundingClientRect();
    const buttons=root.querySelector('.geOfflineChoices').getBoundingClientRect();
    const footer=root.querySelector('.selectionBar').getBoundingClientRect();
    return buttons.top>=0&&buttons.bottom<=innerHeight&&
      buttons.top>dock.top&&buttons.bottom<=dock.bottom+2&&dock.bottom<=footer.top+3;
   })(),
   actionsTappable:[...root.querySelectorAll('[data-ge-offline]')].every(element=>{
    const r=element.getBoundingClientRect();
    const at=root.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return r.top>=0&&r.bottom<=innerHeight&&(at===element||element.contains(at));
   }),
   message:root.querySelector('.geOfflineStatus')?.textContent,
   player:!!root.querySelector('.selectionBar .playSelected')
  };
 });
 assert.equal(display.progress,true);
 assert.match(display.percent,/^\d+%$/);
 assert.match(display.eta,/^ETA:/);
 assert.deepEqual(display.choices,['all','checked','playlist','update']);
 assert(display.optionsVisible&&display.actionsTappable,
   'Homepage OFFLINE must show four reachable choices inside phone viewport: '+JSON.stringify(display));
 assert.equal(display.player,true,'PLAY remains present while OFFLINE choices are shown');
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
 // A locked listener taps ALL MUSIC. The same MUSIC code form must
 // appear without hiding the player or replacing the entire interface.
 const denied=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  root.querySelector('[data-ge-offline="all"]').click();
  return {status:root.querySelector('.geOfflineStatus').textContent,
   visible:root.querySelector('.geOfflineWorkspace').getBoundingClientRect().height>0,
   fullScreen:root.querySelector('.window').classList.contains('geOfflineOpen')};
 });
 assert.equal(denied.visible,true,'Denied access leaves the small dock visible');
 assert.equal(denied.fullScreen,false,'Download must NEVER replace the MUSIC player');
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
 await page.waitForFunction(()=>window.GEOfflineDownloads?.isBusy()===true||
   window.GEOfflineDownloads?.status()?.state==='ready',{timeout:20000});
 // The actual code-entry event starts the previously chosen download.
 // Closing MUSIC must not cancel it or trap the Radio player.
 const nonblocking=await page.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  const footer=root.querySelector('.selectionBar'),dock=root.querySelector('.geOfflineWorkspace');
  const running=window.GEOfflineDownloads.isBusy();
  root.querySelector('.close').click();
  return {running,open:window.GEMusicV5.state().open,
   dock:!!dock,footerVisible:footer.getBoundingClientRect().height>0};
 });
 assert.equal(nonblocking.open,false,'MUSIC must close while the download continues');
 assert.equal(nonblocking.dock,true,'OFFLINE dock remains installed for returning to MUSIC');

 await page.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  const status=root?.querySelector('.geOfflineStatus')?.textContent||'';
  return !window.GEOfflineDownloads?.isBusy()&&window.GEOfflineDownloads?.status()?.state==='ready';
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
 await page.waitForFunction(()=>document.getElementById('offlineLaunchBtn')?.dataset.geState==='ready',{timeout:20000});
 const onlineBadge=await page.evaluate(()=>{
  const btn=document.getElementById('offlineLaunchBtn');
  return {state:btn.dataset.geState,color:getComputedStyle(btn).backgroundColor,
   text:btn.textContent};
 });
 assert.equal(onlineBadge.state,'ready');
 assert.match(onlineBadge.text,/OFFLINE/);
 assert.ok(/18, 108, 71|18, 108, 71/.test(onlineBadge.color),
  'The READY button must visibly turn GREEN, not be overridden by utility CSS: '+JSON.stringify(onlineBadge));
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
  const assets=await (await fetch('./offline-assets.json')).json();
  const backgrounds=[];
  for(const filename of assets.backgrounds){
   const res=await fetch('../ge-images/img/'+filename);
   backgrounds.push({name:filename,status:res.status,size:(await res.blob()).size});
  }
  window.GEBackgrounds.startOfflineBackgroundTwo();
  await new Promise(done=>setTimeout(done,350));
  const visual=document.getElementById('bgImage');
  return {ready:check.ready,mediaStatus:media.status,
   mediaLength:(await media.arrayBuffer()).byteLength,
   imageStatus:image.status,spectrumStatus:spectrum.status,decoded,backgrounds,
   visualSrc:visual.src,visualLoaded:visual.complete&&visual.naturalWidth>0};
 },song);
 assert.equal(result.ready,true,'Airplane Mode reload must remain READY');
 assert.equal(result.mediaStatus,206,'Saved audio range requests must work offline');
 assert.equal(result.mediaLength,128);
 assert.equal(result.imageStatus,200);
 assert.equal(result.spectrumStatus,200);
 assert.ok(result.backgrounds.length>=6&&result.backgrounds.every(b=>b.status===200&&b.size>1000),
  'Every background in the offline package must really be fetchable in Airplane Mode: '+JSON.stringify(result.backgrounds));
 assert.ok(result.visualLoaded,'OFFLINE player background must be a loaded real image, not a broken icon: '+JSON.stringify(result));
 assert.ok(result.visualSrc.endsWith('/47.gif')||result.visualSrc.endsWith('/31.gif'),
  'Offline player must show a guaranteed cached background: '+result.visualSrc);
 assert.ok(Number(result.decoded.duration)>0,
  'Offline cached audio must decode and have a positive duration: '+JSON.stringify(result.decoded));

 // Close the entire browser, then reopen its persisted profile completely
 // disconnected. This tests a true cold boot, not merely a page reload.
 await page.close();
 await browser.close();
 browser=await launch();
 const cold=await browser.newPage();
 await cold.setOfflineMode(true);
 await cold.goto(base+'index.html?ge_home=1',{waitUntil:'domcontentloaded',timeout:30000});
 await cold.waitForFunction(()=>!!window.GEOfflineDownloads&&!!window.GEMusicV5?.open,{timeout:20000});
 const restored=await cold.evaluate(async path=>{
  const status=await window.GEOfflineDownloads.inspect();
  const response=await fetch(new URL('../'+path.split('/').map(encodeURIComponent).join('/'),location.href),{
   headers:{Range:'bytes=0-63'}});
  const button=document.getElementById('offlineLaunchBtn');
  return {ready:status.ready,media:response.status,bytes:(await response.arrayBuffer()).byteLength,
   state:button?.dataset.geState,player:!!document.getElementById('player')};
 },song);
 assert.equal(restored.ready,true,'Full browser restart must preserve offline library');
 assert.equal(restored.media,206,'Cold player must seek saved audio offline');
 assert.equal(restored.bytes,64);
 assert.equal(restored.player,true,'Cold navigation restores the actual Radio player');
 await cold.waitForFunction(()=>document.getElementById('offlineLaunchBtn')?.dataset.geState==='ready',{timeout:20000});
 // Regression for the actual iPhone screenshot: after the entire browser
 // process closes in Airplane Mode, tapping MUSIC must show saved albums,
 // not "Loading albums…" forever.
 await cold.evaluate(()=>document.getElementById('geMusicV5Button').click());
 await cold.waitForFunction(()=>{
  const root=document.getElementById('geMusicV5Host')?.shadowRoot;
  return window.GEMusicV5?.state()?.loaded===true&&
    root?.querySelectorAll('.geStandaloneAlbumUniverse.isActive .geUniverseAlbum').length>=7;
 },{timeout:15000});
 const coldMusic=await cold.evaluate(()=>{
  const root=document.getElementById('geMusicV5Host').shadowRoot;
  const board=root.querySelector('.geUniverseAlbums');
  const covers=[...board.querySelectorAll('.geUniverseAlbum')];
  const img=covers[0]?.querySelector('img');
  return {loaded:window.GEMusicV5.state().loaded,
   names:covers.map(x=>x.dataset.album),
   message:board.textContent,
   coverLoaded:!!img&&img.complete&&img.naturalWidth>0};
 });
 assert.equal(coldMusic.loaded,true,'MUSIC must load its saved catalog directly from Cache Storage');
 assert.equal(coldMusic.coverLoaded,true,'Offline album artwork must be readable without network');
 assert.ok(coldMusic.names.includes('Aether')&&coldMusic.names.includes('Fire'),
  'Offline MUSIC should restore actual saved albums: '+JSON.stringify(coldMusic));
 assert.ok(!/loading albums/i.test(coldMusic.message),'Offline MUSIC cannot hang on Loading albums');
 assert.ok(!coldMusic.names.some(name=>/^singles?$/i.test(name)),'Singles is not an album');
 await cold.evaluate(()=>window.GEMusicV5.close());
 // Old Home Screen shortcuts must open the same cached Radio player.
 await cold.goto(base+'offline-home.html',{waitUntil:'domcontentloaded',timeout:25000});
 await cold.waitForFunction(()=>!!window.GEOfflineDownloads&&!!document.getElementById('player'),{timeout:20000});
 await cold.close();
 console.log('PASS nonblocking OFFLINE dock, verified code, complete downloads, badge and full cold-browser Airplane Mode reopen with MUSIC catalog and artwork');

}finally{
 await browser.close();
}
