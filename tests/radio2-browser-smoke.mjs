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
 console.log('PASS: Radio1 is attempted on arrival; neutral RADIO remains clickable; failed BLITZ never falls back to Radio2.');
}finally{await browser.close();}
