import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
const runtime=[];
page.on('pageerror',error=>runtime.push(error.stack||error.message));
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>!!window.GELiveAudioEQ?.arm,{timeout:15000});
 await page.waitForFunction(()=>!!document.getElementById('geSunCompact')&&
   !!window.GESunEQShare?.exportURL,{timeout:15000});
 assert.equal(await page.evaluate(()=>document.getElementById('sunLabGrid').hidden),true,
   'Phone Sun Lab must start with compact controls, not dozens of sliders');
 assert.equal(await page.evaluate(()=>!!document.getElementById('sunLabCopyPhoneLink')),true,
   'Desktop-to-phone EQ sharing must be visible');
 const desktop=await browser.newPage();
 await desktop.setViewport({width:1100,height:850});
 await desktop.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:45000});
 await desktop.waitForFunction(()=>!!document.getElementById('geSunCompact'),{timeout:15000});
 assert.equal(await desktop.evaluate(()=>document.getElementById('sunLabGrid').hidden),false,
   'Desktop should keep the full Sun Lab editor available');
 await desktop.close();
 assert.equal(await page.evaluate(()=>document.querySelectorAll('button[data-sun-mode]').length),8,'eight effects must exist');
 await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('sunEQAura')).opacity)===0.075,{timeout:8000});
 const idle=await page.evaluate(()=>({
   opacity:getComputedStyle(document.getElementById('sunEQAura')).opacity,
   brightness:JSON.parse(localStorage.getItem('GE_SUN_LAB_V7')||'{}').brightness
 }));
 assert.equal(Number(idle.opacity),0.075,'fixed Sun rays must be nearly invisible with no FFT');
 assert(idle.brightness<=165,'Sun EQ must not default to forced 320 brightness');
 // A real same-origin recorded song, not an oscillator/mock source or a song map.
 const song='/ge-music/music/Grand%20Element%20-%202010%20-%20Intergy/Intergy_03_Amuse.mp3';
 const active=await page.evaluate(async url=>{
   const audio=document.getElementById('player');
   audio.pause();
   audio.src=url; audio.load();
   window.GELiveAudioEQ.arm();
   await audio.play();
   return {src:audio.currentSrc,mode:window.GELiveAudioEQ.status().mode};
 },song);
 assert.equal(active.mode,'gate-shared','EQ must use the actual Gate Web Audio source, not a second graph');
 await page.waitForFunction(()=>{
   const sample=window.GELiveAudioEQ?.read?.();
   const s=window.GELiveAudioEQ?.status?.();
   const audio=document.getElementById('player');
   return !!sample&&s?.live===true&&audio?.currentTime>.3;
 },{timeout:30000,polling:200});
 // Monitor the user's exact Amuse recording while it plays naturally.
 // Seeking may produce a silent output graph on a bare Python test server.
 const audioTimeline=[];
 for(let i=0;i<12;i++){
   audioTimeline.push(await page.evaluate(()=>{
     const a=document.getElementById('player');
     const native=window.GELiveAudioEQ?.read?.();
     const main=window.GEGetLiveSpectrum?.();
     return {t:Math.round(a.currentTime*10)/10,
       nativeEnergy:native?Array.from(native).reduce((sum,v)=>sum+v,0):0,
       mainEnergy:main?Array.from(main).reduce((sum,v)=>sum+v,0):0,
       ui:document.getElementById('sunEQSourceStatus')?.textContent,
       opacity:getComputedStyle(document.getElementById('sunEQAura')).opacity};
   }));
   await new Promise(resolve=>setTimeout(resolve,950));
 }
 console.log('AMUSE_AUDIO_TIMELINE '+JSON.stringify(audioTimeline));
 // Waterfall is the default iPhone-looking radial mode in the user screenshot.
 // Verify real FFT moves the actual spokes before switching to Spectrum.
 const radialFrames=[];
 for(let i=0;i<5;i++){
   radialFrames.push(await page.evaluate(()=>{
     const rays=[...document.querySelectorAll('#sunEQAura .sun-eq-radial-group .sun-eq-ray')];
     return {
       count:rays.length,
       opacity:Number(getComputedStyle(document.getElementById('sunEQAura')).opacity),
       shape:rays.slice(0,45).map(r=>r.getAttribute('x2')+'|'+r.getAttribute('y2')+'|'+r.style.opacity).join(';'),
       currentStatus:document.getElementById('sunEQSourceStatus')?.textContent,
       shipReady:!!window.GEShip,
       audioLive:!!window.GEGetLiveSpectrum?.(),
       styleInline:document.getElementById('sunEQAura')?.style.opacity
     };
   }));
   await new Promise(resolve=>setTimeout(resolve,190));
 }
 console.log('WATERFALL_DIAGNOSTICS '+JSON.stringify({
   frames:radialFrames.map(({count,opacity,currentStatus,shipReady,audioLive,styleInline})=>
     ({count,opacity,currentStatus,shipReady,audioLive,styleInline})),
   errors:runtime.slice(0,5)
 }));
 assert(radialFrames.every(f=>f.count===72),'Waterfall needs 72 real-frequency radial spokes');
 assert(radialFrames.some(f=>f.opacity>.95),'measured music should make Waterfall visible');
 assert(new Set(radialFrames.map(f=>f.shape)).size>=2,'Waterfall spoke lengths must change with real music');
 console.log('PASS Waterfall spokes: '+new Set(radialFrames.map(f=>f.shape)).size+' distinct actual music frames');
 // Change an actual visual mode, then verify its geometry responds.
 await page.evaluate(()=>document.querySelector('[data-sun-mode="spectrum"]')?.click());
 await page.waitForFunction(()=>document.querySelector('#sunEQAura')?.children.length===110,{timeout:5000});
 const readings=[];
 for(let i=0;i<9;i++){
   const datum=await page.evaluate(()=>{
     const a=document.getElementById('player');
     const bins=window.GELiveAudioEQ.read()||[];
     return {time:a.currentTime,paused:a.paused,
       status:window.GELiveAudioEQ.status(),
       energy:Array.from(bins).reduce((n,x)=>n+x,0),
       first:Array.from(bins).slice(0,32),
       rings:Array.from(document.querySelector('#sunEQAura')?.children||[]).slice(0,30)
         .map(r=>r.style.getPropertyValue('--spectrum-width')).join(',')};
   });
   readings.push(datum);
   await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert(readings.at(-1).time-readings[0].time>1,'real audio playback must advance');
 assert(readings.some(row=>row.energy>0),'actual frequency energy must be present');
 assert(new Set(readings.map(row=>row.energy)).size>=2,'frequency energy must change with the recording');
 assert(new Set(readings.map(row=>row.rings)).size>=2,'visible Spectrum rings must change while real music plays');
 // Pause cuts energy. Never fake a moving EQ after playback ends.
 await page.evaluate(()=>document.getElementById('player').pause());
 const stopped=await page.evaluate(()=>window.GELiveAudioEQ.read());
 assert.equal(stopped,null,'paused playback must not show live signal');
 await page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('sunEQAura')).opacity)===0.075,{timeout:5000});
 // Test the separate MUSIC player as it is mounted in the Radio iframe.
 // This must use its own real transport and Gate-shared FFT, not song snapshots.
 await page.evaluate(()=>{if(typeof geInlineMusicInit==='function')geInlineMusicInit();});
 await page.waitForFunction(()=>!!document.getElementById('geInlineMusicFrame')
   ?.contentWindow?.GEGetMusicTransport,{timeout:25000});
 const musicMode=await page.evaluate(async url=>{
   const frame=document.getElementById('geInlineMusicFrame')?.contentWindow;
   const a=frame?.GEGetMusicTransport?.();
   if(!a)throw Error('MUSIC transport missing');
   window.GEInlineMusic.beforePlay('Intergy · Amuse');
   a.pause(); a.crossOrigin='anonymous'; a.src=url; a.preload='auto';
   frame.GEAudioGain.arm();
   await a.play();
   return frame.GEAudioGain.getStatus();
 },song);
 assert(musicMode?.spectrumReady,'MUSIC must create a live spectrum fork on its own audio element');
 await page.waitForFunction(()=>{
   const frame=document.getElementById('geInlineMusicFrame')?.contentWindow;
   const a=frame?.GEGetMusicTransport?.();
   const bins=window.GEGetLiveSpectrum?.();
   return !a?.paused&&a.currentTime>.3&&bins?.some(v=>v>1)&&
     document.getElementById('sunEQSourceStatus')?.textContent?.includes('LIVE AUDIO SIGNAL');
 },{timeout:30000,polling:200});
 const musicFrames=[];
 for(let i=0;i<7;i++){
   musicFrames.push(await page.evaluate(()=>{
     const frame=document.getElementById('geInlineMusicFrame').contentWindow;
     const raw=frame.GEAudioGain.getSpectrumFrame()?.bins||[];
     const output=window.GEGetLiveSpectrum?.()||[];
     const energy=data=>Array.from(data).reduce((sum,v)=>sum+v,0);
     return {t:frame.GEGetMusicTransport().currentTime,
       raw:energy(raw),live:energy(output),
       shape:[...document.querySelectorAll('#sunEQAura>*')].slice(0,20)
         .map(r=>r.style.getPropertyValue('--spectrum-width')).join(',')};
   }));
   await new Promise(resolve=>setTimeout(resolve,230));
 }
 assert(musicFrames.every(x=>x.raw>0&&x.live>0),'MUSIC must deliver actual PCM FFT to Radio');
 assert(new Set(musicFrames.map(x=>x.live)).size>=2,'MUSIC EQ must fluctuate with real recording');
 assert(new Set(musicFrames.map(x=>x.shape)).size>=2,'MUSIC Sun rays must respond to the live FFT');
 console.log('PASS separate MUSIC audio live FFT, '+new Set(musicFrames.map(x=>x.shape)).size+' changing visual frames');
 await page.evaluate(()=>document.getElementById('geInlineMusicFrame')
   ?.contentWindow?.GEGetMusicTransport?.().pause());
 // Mobile opt-in contract: default iPhone session never touches the audio graph.
 const iosUA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
 const iosPage=await browser.newPage();
 await iosPage.setUserAgent(iosUA);
 await iosPage.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:45000});
 await iosPage.waitForFunction(()=>!!window.GELiveAudioEQ?.arm,{timeout:15000});
 const locked=await iosPage.evaluate(()=>({arm:window.GELiveAudioEQ.arm(),status:window.GELiveAudioEQ.status()}));
 assert.equal(locked.arm,false,'ordinary iPhone session must not reroute native audio');
 assert.equal(locked.status.mode,'none','ordinary iPhone session has no Web Audio graph');
 const toggle=await iosPage.evaluate(()=>({
   hidden:document.getElementById('geSunEQEnable')?.hidden,
   text:document.getElementById('geSunEQEnable')?.textContent
 }));
 assert.equal(toggle.hidden,false,'iPhone must show an accessible one-tap live EQ control');
 assert.match(toggle.text,/ENABLE LIVE EQ/);
 await iosPage.evaluate(()=>document.getElementById('geSunEQEnable').click());
 const opted=await iosPage.evaluate(()=>window.GELiveAudioEQ.status());
 assert.equal(opted.iosEnabled,true,'iPhone opt-in must activate the real analyzer');
 assert.notEqual(opted.mode,'none','iPhone opt-in must attach to the native audio element');
 await iosPage.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:45000});
 await iosPage.waitForFunction(()=>!!window.GELiveAudioEQ?.arm,{timeout:15000});
 assert.equal(await iosPage.evaluate(()=>window.GELiveAudioEQ.status().iosEnabled),true,
  'iPhone live-EQ opt-in must remain enabled after reload');
 await iosPage.evaluate(async url=>{
   const a=document.getElementById('player');a.src=url;a.load();
   await a.play();
 },song);
 await iosPage.waitForFunction(()=>{
   const audio=document.getElementById('player');
   return !!window.GELiveAudioEQ.read()&&audio.currentTime>.25;
 },{timeout:30000,polling:200});
 assert.equal((await iosPage.evaluate(()=>window.GELiveAudioEQ.status())).live,true,
   'opted-in iPhone user agent must report real MP3 FFT energy');
 await iosPage.goto('http://127.0.0.1:8765/radio/?eq_preview=1',{waitUntil:'domcontentloaded',timeout:45000});
 await iosPage.waitForFunction(()=>!!window.GELiveAudioEQ?.arm,{timeout:15000});
 const preview=await iosPage.evaluate(()=>({arm:window.GELiveAudioEQ.arm(),status:window.GELiveAudioEQ.status()}));
 assert.equal(preview.arm,true,'iPhone explicit preview must allow the real FFT');
 assert.equal(preview.status.iosPreview,true);
 await iosPage.close();
 console.log('PASS iPhone preview safety gate: native session untouched without ?eq_preview=1');
 console.log('PASS live MP3 FFT:',JSON.stringify({
   mode:active.mode,
   duration:Number((readings.at(-1).time-readings[0].time).toFixed(2)),
   distinctEnergies:new Set(readings.map(row=>row.energy)).size,
   distinctVisualFrames:new Set(readings.map(row=>row.rings)).size,
   energyRange:[Math.min(...readings.map(row=>row.energy)),Math.max(...readings.map(row=>row.energy))],
   runtimeErrors:runtime.slice(0,5)
 }));
}catch(error){
 const diagnostics=await page.evaluate(()=>{
   const a=document.getElementById('player'),s=window.GELiveAudioEQ?.status?.();
   return {url:location.href,time:a?.currentTime,paused:a?.paused,muted:a?.muted,volume:a?.volume,hidden:document.hidden,src:a?.src,ready:a?.readyState,error:a?.error?.message,status:s,
     sunStatus:document.getElementById('sunEQSourceStatus')?.textContent};
 }).catch(()=>null);
 throw Error(error.message+' | '+JSON.stringify({diagnostics,runtime:runtime.slice(0,5)}));
}finally{await browser.close()}
