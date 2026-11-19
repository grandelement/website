import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
const runtime=[];
page.on('pageerror',error=>runtime.push(error.message));
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>!!window.GELiveAudioEQ?.arm,{timeout:15000});
 assert.equal((await page.$$('button[data-sun-mode]')).length,8,'eight effects must exist');
 // A real same-origin recorded song, not an oscillator/mock source or a song map.
 const song='/ge-music/music/Grand%20Element%20-%202005%20-%20Fundamental%20Groove/Fundamental%20Groove_01_Intro.mp3';
 const active=await page.evaluate(async url=>{
   const audio=document.getElementById('audio');
   audio.pause();
   audio.src=url; audio.load();
   window.GELiveAudioEQ.arm();
   await audio.play();
   return {src:audio.currentSrc,mode:window.GELiveAudioEQ.status().mode};
 },song);
 assert.equal(active.mode==='capture'||active.mode==='media-element',true,'native player analyzer must initialize');
 await page.waitForFunction(()=>{
   const sample=window.GELiveAudioEQ?.read?.();
   const s=window.GELiveAudioEQ?.status?.();
   const audio=document.getElementById('audio');
   return !!sample&&s?.live===true&&audio?.currentTime>.3;
 },{timeout:30000,polling:200});
 const readings=[];
 for(let i=0;i<9;i++){
   const datum=await page.evaluate(()=>{
     const a=document.getElementById('audio');
     const bins=window.GELiveAudioEQ.read()||[];
     return {time:a.currentTime,paused:a.paused,
       status:window.GELiveAudioEQ.status(),
       energy:Array.from(bins).reduce((n,x)=>n+x,0),
       first:Array.from(bins).slice(0,32)};
   });
   readings.push(datum);
   await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert(readings.at(-1).time-readings[0].time>1,'real audio playback must advance');
 assert(readings.some(row=>row.energy>0),'actual frequency energy must be present');
 assert(new Set(readings.map(row=>row.energy)).size>=2,'frequency energy must change with the recording');
 // Pause cuts energy. Never fake a moving EQ after playback ends.
 await page.evaluate(()=>document.getElementById('audio').pause());
 const stopped=await page.evaluate(()=>window.GELiveAudioEQ.read());
 assert.equal(stopped,null,'paused playback must not show live signal');
 console.log('PASS live MP3 FFT:',JSON.stringify({
   mode:active.mode,
   duration:Number((readings.at(-1).time-readings[0].time).toFixed(2)),
   distinctEnergies:new Set(readings.map(row=>row.energy)).size,
   energyRange:[Math.min(...readings.map(row=>row.energy)),Math.max(...readings.map(row=>row.energy))],
   runtimeErrors:runtime.slice(0,5)
 }));
}catch(error){
 const diagnostics=await page.evaluate(()=>{
   const a=document.getElementById('audio'),s=window.GELiveAudioEQ?.status?.();
   return {url:location.href,time:a?.currentTime,paused:a?.paused,muted:a?.muted,volume:a?.volume,hidden:document.hidden,src:a?.src,ready:a?.readyState,error:a?.error?.message,status:s,
     sunStatus:document.getElementById('sunEQSourceStatus')?.textContent};
 }).catch(()=>null);
 throw Error(error.message+' | '+JSON.stringify({diagnostics,runtime:runtime.slice(0,5)}));
}finally{await browser.close()}
