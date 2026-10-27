import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
  headless:true,
  args:['--no-sandbox','--disable-setuid-sandbox','--autoplay-policy=no-user-gesture-required']
});
let page;
try{
  page=await browser.newPage();
  await page.setViewport({width:390,height:844});
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err?.message||err).slice(0,180)));
  await page.goto('https://grandelement.com/radio/?browser-qa=503-backup',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('#liveBtn',{timeout:15000});
  // Force the known primary-station outage, rather than relying on the
  // intermittent live failure to be present during CI.
  await page.setRequestInterception(true);
  page.on('request',req=>{
    if(req.url().includes('radio.grandelement.blitz.cloud/stream.mp3'))
      void req.respond({status:503,contentType:'text/plain',body:'BLITZ unavailable'});
    else void req.continue();
  });
  const start=Date.now();
  await page.click('#liveBtn');
  try{
    await page.waitForFunction(()=>{
      const s=document.querySelector('#liveStatus')?.textContent||'';
      const audio=document.querySelector('#player');
      return /RADIO 2 ·/.test(s) && !/UNAVAILABLE|NOT READY/i.test(s) &&
        audio?.currentSrc?.includes('/ge-music/');
    },{timeout:43000,polling:500});
  }catch(error){
    const debug=await page.evaluate(()=>({
      status:document.querySelector('#liveStatus')?.textContent,
      src:document.querySelector('#player')?.currentSrc,
      paused:document.querySelector('#player')?.paused,
      readyState:document.querySelector('#player')?.readyState
    }));
    throw new Error('Browser did not activate the real Radio2 fallback: '+JSON.stringify(debug)+' JS: '+JSON.stringify(errors.slice(-5)));
  }
  if(Date.now()-start>40000)throw new Error('Radio2 fallback exceeded 40 seconds after primary 503');
  const initial=await page.$eval('#player',a=>({time:a.currentTime,source:a.currentSrc,paused:a.paused}));
  await new Promise(resolve=>setTimeout(resolve,5000));
  const after=await page.$eval('#player',a=>({time:a.currentTime,source:a.currentSrc,paused:a.paused,readyState:a.readyState}));
  console.log('RADIO BROWSER INITIAL',JSON.stringify(initial));
  console.log('RADIO BROWSER AFTER',JSON.stringify(after));
  if(after.paused||after.readyState<2||after.time<initial.time+1.5)
    throw new Error('Radio2 failed actual browser playback progress check. '+JSON.stringify(after));
  console.log('PASS: real browser switched away from failed BLITZ to Radio2 and played real music for 5 seconds');
  // End-to-end check, not a mock: the historic public LOVE code is already
  // documented as the original Radio Gate code. Verify D1 rejects/accepts
  // through the actual REST endpoint and the opened Gate UI.
  await page.evaluate(()=>window.GEGate.openCodeEntry());
  await page.waitForSelector('#geGateWord',{visible:true,timeout:10000});
  await page.type('#geGateWord','LOVE');
  const verify=page.waitForResponse(r=>r.url().includes('/v1/public/access/redeem'),{timeout:30000});
  await page.click('#geGateEnter');
  const redemption=await verify;
  const redemptionData=await redemption.json().catch(()=>({}));
  if(redemption.status()!==200||redemptionData.ok!==true)
    throw new Error('Actual Vault Radio redeem denied historic authorized gate code: HTTP '+redemption.status());
  await page.waitForFunction(()=>window.GEGate?.isAuthorized?.()===true,{timeout:10000});
  const gateAfter=await page.$eval('#player',a=>({time:a.currentTime,paused:a.paused}));
  await new Promise(resolve=>setTimeout(resolve,3000));
  const gateProgress=await page.$eval('#player',a=>({time:a.currentTime,paused:a.paused,readyState:a.readyState}));
  console.log('RADIO GATE AFTER',JSON.stringify(gateProgress));
  if(gateProgress.paused||gateProgress.time<gateAfter.time+1)
    throw new Error('Radio stopped playing after real Vault gate authorization');
  console.log('PASS: live Vault D1 radio scope redemption opens actual Gate and Radio2 audio continues after authorization');
}finally{await browser.close();}
