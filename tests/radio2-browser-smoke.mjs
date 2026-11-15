// Radio 1-only smoke; historical filename kept for the existing workflow.
// Simulated BLITZ 503 must never switch a listener to Radio 2.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--autoplay-policy=no-user-gesture-required']
});
try{
 const page=await browser.newPage();
 await page.setViewport({width:390,height:844});
 let primary=0,backup=0;
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=request.url();
  if(url.includes('radio.grandelement.blitz.cloud/stream.mp3')){
   primary++;void request.respond({status:503,contentType:'text/plain',body:'BLITZ temporarily unavailable'});return;
  }
  if(url.includes('ge-radio-sync.grandelement.workers.dev/v1/program')){
   backup++;void request.abort();return;
  }
  void request.continue();
 });
 await page.goto('http://127.0.0.1:8765/radio/?qa-radio1-only=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#liveBtn')?.textContent?.trim()==='RADIO',{timeout:12000});
 const first=await page.evaluate(()=>{
  const b=document.querySelector('#liveBtn'),style=getComputedStyle(b);
  return{text:b.textContent.trim(),opacity:style.opacity,events:style.pointerEvents,
   color:style.color,background:style.backgroundColor,
   connected:document.body.classList.contains('ge-radio-audible')};
 });
 assert.equal(first.text,'RADIO');
 assert.equal(first.opacity,'1','RADIO must be visible before connection');
 assert.equal(first.events,'auto','RADIO must be clickable before connection');
 assert.equal(first.connected,false,'Failed BLITZ must not show connected heartbeat');
 // Simulate a listener who already completed the browser wake step.
 // The connected-state regression still verifies direct Radio 1 retries.
 await page.evaluate(()=>sessionStorage.setItem('GE_BLITZ_VISITOR_WAKE_RECENT_V1',String(Date.now())));
 await page.click('#liveBtn');
 await new Promise(resolve=>setTimeout(resolve,2500));
 const after=await page.evaluate(()=>({
  text:document.querySelector('#liveBtn')?.textContent,
  status:document.querySelector('#liveStatus')?.textContent||'',
  src:document.querySelector('#player')?.currentSrc||document.querySelector('#player')?.src,
  connected:document.body.classList.contains('ge-radio-audible'),
  playText:document.querySelector('#playBtn')?.textContent?.trim(),
  nativeNoCors:!document.querySelector('#player')?.hasAttribute('crossorigin'),
  nativeMode:document.querySelector('#player')?.dataset?.geRadioNativeNoCors
 }));
 assert.equal(after.playText,'Play','Failed BLITZ must not falsely start on PAUSE');
 assert.equal(after.nativeNoCors,true,'BLITZ MP3 must not send Origin from crossorigin audio');
 assert.equal(after.nativeMode,'1','BLITZ must use native no-CORS mode');
 assert.ok(!/RADIO 2/.test(after.status),'Radio 2 must not be selected after primary outage');
 assert.ok(!after.src||after.src.includes('radio.grandelement.blitz.cloud/stream.mp3'),
  'Radio 2 or local songs replaced BLITZ');
 assert.equal(after.connected,false,'Red heartbeat must not start without audio progress');
 assert.equal(backup,0,'Radio 2 program must never be fetched');
 assert.ok(primary>0,'BLITZ Radio 1 must attempt to connect on page arrival');
 // The main PLAY button no longer retries the live Radio source: it invokes
 // ALL songs in the existing licensed music player, even during BLITZ startup.
 const playRoute=await page.evaluate(()=>{
   const music=window.GEMusicV5;
   if(!music?.playAll)return {loaded:false};
   const original=music.playAll;
   let route='';
   try{
     music.playAll=mode=>{route=mode;return true;};
     document.querySelector('#playBtn').click();
   }finally{music.playAll=original;}
   return {loaded:true,route,label:document.querySelector('#playBtn')?.textContent?.trim()};
 });
 assert.equal(playRoute.loaded,true,'Music library controller must initialize on page load');
 assert.equal(playRoute.route,'all','Main PLAY must launch all available songs, not retry BLITZ');
 assert.equal(playRoute.label,'Play','Main PLAY may not report PAUSE for unverified Radio');
 const wakeLink=await page.evaluate(()=>{
   const a=document.querySelector('#geRadioWakeLink');
   const box=a?.getBoundingClientRect();
   return a?{hidden:a.hidden,href:a.href,target:a.target,
     display:getComputedStyle(a).display,top:box.top,bottom:box.bottom,width:box.width}:null;
 });
 assert.ok(wakeLink,'BLITZ wake link must exist for sleeping-app recovery');
 assert.equal(wakeLink.href,'https://radio.grandelement.blitz.cloud/');
 assert.equal(wakeLink.target,'','Wake link must use the listener\'s real browser tab');
 assert.equal(wakeLink.hidden,true,'Connecting UI must not add a second wake/status bar');
 assert.equal(await page.evaluate(()=>browserWakeOnRadioTap()),false,'RADIO tap must not redirect to un-deployed 404 wake route');
 assert.equal(await page.evaluate(()=>typeof wakeBlitzFromPageVisit),'function','Radio page must attempt a browser-based wake on load');
 assert.equal(wakeLink.display,'none','Connection status must stay inside RADIO button');
 // OFFLINE belongs in MUSIC and must open its local CODE entry when locked.
 // Never put OFFLINE, RELOAD or DEBUG back in the public footer.
 await page.waitForFunction(()=>typeof window.GEMusicV5?.open==='function',{timeout:12000});
 await page.evaluate(()=>window.GEMusicV5.open());
 await page.waitForFunction(()=>{
  const root=document.querySelector('#geMusicV5Host')?.shadowRoot;
  return !!root?.querySelector('.geMusicOfflineTrigger');
 },{timeout:12000});
 const offline=await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host')?.shadowRoot;
  const b=root.querySelector('.geMusicOfflineTrigger'),r=b.getBoundingClientRect();
  return {text:b.textContent.trim(),width:r.width,hidden:b.hidden,display:getComputedStyle(b).display,
    publicOffline:!!document.querySelector('#bottomActions > #offlineBtn'),
    publicReload:!!document.querySelector('#geUtilityRow > #reloadBtn'),
    publicDebug:!!document.querySelector('#geUtilityRow > #geDebugOpen')};
 });
 assert.equal(offline.publicOffline,false,'OFFLINE must not appear in public Radio');
 assert.equal(offline.publicReload,false,'RELOAD must not appear in public Radio');
 assert.equal(offline.publicDebug,false,'DEBUG must not appear in public Radio');
 assert.ok(offline.text.includes('LOCKED'),'Guest MUSIC OFFLINE must say locked');
 assert.ok(offline.width>0&&offline.display!=='none'&&!offline.hidden,
  'Guest MUSIC OFFLINE must be visible and tappable');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geMusicOfflineTrigger').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.musicCodeTools')?.hidden===false,{timeout:8000});
 assert.equal(await page.evaluate(()=>window.GEMusicV5.state()?.open),true,
  'Locked MUSIC OFFLINE must open access code without leaving MUSIC');
 await page.evaluate(()=>window.GEMusicV5.close());

 // SUN LAB is permission gated and left of SUPPORT; both must be on one row.
 const sunLab=await page.evaluate(()=>{
  sessionStorage.setItem('GE_VAULT_SCOPED_ACCESS_V1',JSON.stringify({
   scopes:['website','radio','music','albums','games','offline','reload'],
   until:Date.now()+3600000,verifiedFor:'radio',sunLab:true
  }));
  window.GERadioSyncOfflineAccess?.();
  const dims=element=>{
   const r=element.getBoundingClientRect();
   return {hidden:element.hidden,top:r.top,left:r.left,right:r.right,width:r.width,height:r.height};
  };
  return {
   sun:dims(document.getElementById('sunLabBtn')),
   support:dims(document.querySelector('#geUtilityRow > .bc-btn'))
  };
 });
 assert.equal(sunLab.sun.hidden,false,'Verified LOVE must show SUN LAB');
 assert.ok(sunLab.sun.width>0,'SUN LAB must be clickable');
 assert.ok(Math.abs(sunLab.sun.top-sunLab.support.top)<5,'SUN LAB and SUPPORT should share a row');
 assert.ok(sunLab.sun.right<=sunLab.support.left+2,'SUN LAB must be left of SUPPORT');
 const songTitle=await page.evaluate(()=>{
   window.GEInlineMusic?.beforePlay?.('FIRE · SOUL');
   return document.querySelector('#titleBtn')?.textContent?.trim();
 });
 assert.equal(songTitle,'FIRE · SOUL',
   'When a song begins the actual Album / Song title must appear above PLAY');
 console.log('PASS: Main PLAY ALL and track title, Radio 1 separation, MUSIC OFFLINE and SUN LAB placement.');
}finally{await browser.close();}
