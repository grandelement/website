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
  connected:document.body.classList.contains('ge-radio-audible')
 }));
 assert.ok(!/RADIO 2/.test(after.status),'Radio 2 must not be selected after primary outage');
 assert.ok(!after.src||after.src.includes('radio.grandelement.blitz.cloud/stream.mp3'),
  'Radio 2 or local songs replaced BLITZ');
 assert.equal(after.connected,false,'Red heartbeat must not start without audio progress');
 assert.equal(backup,0,'Radio 2 program must never be fetched');
 assert.ok(primary>0,'BLITZ Radio 1 must attempt to connect on page arrival');
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
 // OFFLINE is discoverable without a code, but only a Vault-verified scope
 // may start a download. The locked button must open the existing CODE gate.
 await page.waitForFunction(()=>document.querySelector('#offlineBtn')?.getAttribute('aria-disabled')==='true',{timeout:12000});
 const offline=await page.evaluate(()=>{
  const b=document.querySelector('#offlineBtn'),style=getComputedStyle(b),box=b.getBoundingClientRect();
  return {hidden:b.hidden,display:style.display,events:style.pointerEvents,
    bounds:{top:box.top,bottom:box.bottom,width:box.width},
    locked:b.getAttribute('aria-disabled'),text:b.textContent.trim()};
 });
 assert.equal(offline.hidden,false,'OFFLINE must not be hidden before code entry');
 assert.notEqual(offline.display,'none','OFFLINE must be visible to guests');
 assert.notEqual(offline.events,'none','OFFLINE must open the Gate when locked');
 assert.ok(offline.bounds.width>0 && offline.bounds.top>=0 && offline.bounds.bottom<=844,
  'OFFLINE must fit within the iPhone viewport');
 assert.equal(offline.locked,'true','Guest OFFLINE must remain locked');
 await page.click('#offlineBtn',{timeout:12000});
 await page.waitForFunction(()=>document.querySelector('#geGate')?.getAttribute('aria-hidden')==='false',{timeout:8000});
 assert.equal(await page.evaluate(()=>document.querySelector('#geGate')?.classList.contains('open')),true,
  'Locked OFFLINE must open the existing CODE entry');
 // The actual historic LOVE record is verified in the Vault unit test.
 // Simulate its returned scoped receipt here to verify responsive placement.
 const sunLab=await page.evaluate(()=>{
  sessionStorage.setItem('GE_VAULT_SCOPED_ACCESS_V1',JSON.stringify({
   scopes:['website','radio','music','albums','games','offline','reload'],
   until:Date.now()+3600000,verifiedFor:'radio',sunLab:true
  }));
  window.GERadioSyncOfflineAccess?.();
  const dimensions=id=>{
   const element=document.getElementById(id),rect=element.getBoundingClientRect();
   return {hidden:element.hidden,top:rect.top,left:rect.left,right:rect.right,width:rect.width};
  };
  return {sun:dimensions('sunLabBtn'),support:dimensions('bottomActions')&&(()=>{
   const r=document.querySelector('#bottomActions > .bc-btn').getBoundingClientRect();
   return {top:r.top,left:r.left,right:r.right,width:r.width}})(),
   offline:dimensions('offlineBtn')};
 });
 assert.equal(sunLab.sun.hidden,false,'Verified LOVE must show SUN LAB');
 assert.ok(sunLab.sun.width>0,'SUN LAB must have a clickable width');
 assert.ok(Math.abs(sunLab.sun.top-sunLab.support.top)<5 &&
           Math.abs(sunLab.sun.top-sunLab.offline.top)<5,
  'SUN LAB, SUPPORT, OFFLINE must be on the same row');
 assert.ok(sunLab.sun.right<=sunLab.support.left+2 &&
           sunLab.support.right<=sunLab.offline.left+2,
  'SUN LAB must be left of SUPPORT, and OFFLINE must be right');
 console.log('PASS: BLITZ Radio1 only, guest OFFLINE code entry and verified LOVE SUN LAB placement.');
}finally{await browser.close();}
