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
  const initial=await page.$eval('#player',a=>({time:a.currentTime,source:a.currentSrc,paused:a.paused}));
  await new Promise(resolve=>setTimeout(resolve,5000));
  const after=await page.$eval('#player',a=>({time:a.currentTime,source:a.currentSrc,paused:a.paused,readyState:a.readyState}));
  console.log('RADIO BROWSER INITIAL',JSON.stringify(initial));
  console.log('RADIO BROWSER AFTER',JSON.stringify(after));
  if(after.paused||after.readyState<2||after.time<initial.time+1.5)
    throw new Error('Radio2 failed actual browser playback progress check. '+JSON.stringify(after));
  console.log('PASS: real browser switched away from failed BLITZ to Radio2 and played real music for 5 seconds');
}finally{await browser.close();}
