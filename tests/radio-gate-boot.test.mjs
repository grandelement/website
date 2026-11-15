import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

// The original Radio is the ONLY public player. Never restore a competing Lite site.
assert.equal(existsSync('lite/index.html'),false,'Legacy Lite radio page must not exist');
const siteWorker=readFileSync('sw.js','utf8');
assert.match(siteWorker,/LEGACY_RADIO_PATHS\.some/,'Old Lite links must route to canonical Radio');
assert.match(siteWorker,/cache\.delete\(url\.href\)/,'Obsolete Lite pages must be purged without removing saved music');
const musicSource=readFileSync('radio/ge-music-v5.js','utf8');
const radioSource=readFileSync('radio/index.html','utf8');
assert.doesNotMatch(musicSource, /state\.view\s*=\s*['"]access-code['"]|setView\(['"]access-code['"]\)/,
  'An access code may not force a separate Music UI');
assert.doesNotMatch(radioSource, /location\.assign\(['"]\.\.\/support\/\?section=radio&flow=shop['"]\)/,
  'Missing code may not navigate away from Radio');
assert.match(radioSource, /Close access code and return to Radio/,
  'Gate Back must remain on Radio');
assert.doesNotMatch(radioSource,/geInlineMusicPanel\.classList\.add\('ge-gate-active'\)/,
  'Embedded preview must not take over the entire Radio interface');
assert.match(radioSource,/GEMusicV5\?\.openCodeEntry\?\.\(\)/,
  'Expired Music preview must prompt for its code in existing Music UI');
assert.match(musicSource,/function openCodeEntry\(\)/,
  'One Music screen owns code entry while the preview engine stays hidden');


for(const path of ['index.html','radio/index.html']){
  const html=readFileSync(path,'utf8');
  assert.doesNotMatch(html,/location\.(?:replace|assign)\(['"]\/lite\//,
    path+' must not redirect listeners to Lite');
}

const browser=await puppeteer.launch({
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox','--disable-setuid-sandbox']
});
try{
  const page=await browser.newPage();
  const errors=[];
  // Simulate Safari rejecting autoplay. Merely opening the page must not
  // call audio.play(), select RADIO or claim a song is playing.
  await page.evaluateOnNewDocument(()=>{
    window.__geRadioPlayAttempts=0;
    HTMLMediaElement.prototype.play=function(){
      window.__geRadioPlayAttempts++;
      return Promise.reject(new DOMException('Autoplay blocked for test','NotAllowedError'));
    };
  });
  page.on('pageerror',error=>errors.push(String(error?.stack||error?.message||error).slice(0,900)));
  await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
  try{
    await page.waitForFunction(()=>typeof window.GEGate?.openCodeEntry==='function',{timeout:12000});
  }catch(_e){
    throw new Error('Full Radio Gate controller did not boot from this commit. Errors: '+JSON.stringify(errors.slice(-8)));
  }
  if(errors.length)throw new Error('Radio JavaScript boot failed: '+JSON.stringify(errors.slice(-8)));
  console.log('PASS: fresh browser initializes Sun Lab and real Gate controller with zero JavaScript exceptions');
  // Press the actual controls, not just their JavaScript functions.
  const canonicalUrl=new URL(page.url()).pathname;
  await page.click('#accessLaunchBtn');
  await page.waitForFunction(()=>document.querySelector('#geGate')?.classList.contains('open'),{timeout:8000});
  await page.click('#geGateBack');
  await page.waitForFunction(()=>document.querySelector('#geGate')?.getAttribute('aria-hidden')==='true',{timeout:8000});
  assert.equal(new URL(page.url()).pathname,canonicalUrl,'CODE Back must not navigate to another website');
  await page.click('#geMusicV5Button');
  await page.waitForFunction(()=>window.GEMusicV5?.state?.().open===true,{timeout:8000});
  await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot
    ?.querySelector('[data-tab="songs"]')?.getAttribute('aria-pressed')==='true',{timeout:8000});
  console.log('PASS: MUSIC opens normal SONGS on same Radio, without alternate CODE screen');
  const codeButton=await page.evaluate(()=>{
    const el=document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.accessToggle');
    const rect=el.getBoundingClientRect();
    return {x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2,
      visible:rect.width>0&&rect.height>0&&getComputedStyle(el).visibility!=='hidden'};
  });
  assert.ok(codeButton.visible,'MUSIC ACCESS CODE must be visible and tappable');
  await page.mouse.click(codeButton.x,codeButton.y);
  await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot
    ?.querySelector('.musicCodeTools')?.hidden===false,{timeout:8000});
  assert.equal(new URL(page.url()).pathname,canonicalUrl,'MUSIC ACCESS CODE must stay on the Radio URL');
  await page.evaluate(()=>window.GEMusicV5.close());
  console.log('PASS: real CODE, Back, MUSIC and ACCESS CODE clicks stay on one Radio page');
  await page.waitForFunction(()=>document.querySelector('#titleBtn')?.textContent?.trim()==='Select a song',{timeout:20000});
  const idle=await page.evaluate(()=>({
    title:document.querySelector('#titleBtn')?.textContent?.trim(),
    radioPressed:document.querySelector('#liveBtn')?.getAttribute('aria-pressed'),
    radioAudible:document.body.classList.contains('ge-radio-audible'),
    source:document.querySelector('#player')?.getAttribute('src')||'',
    audioCalls:window.__geRadioPlayAttempts
  }));
  if(idle.title!=='Select a song'||idle.radioPressed!=='false'||
    idle.radioAudible||idle.source||idle.audioCalls!==0)
    throw new Error('Radio autoplayed or displayed a phantom title on arrival: '+JSON.stringify(idle));
  console.log('PASS: idle Radio loads catalog without autoplay or a false track title');
  // A manual RADIO tap is the only event that can select the station.
  await page.click('#liveBtn');
  await page.waitForFunction(()=>document.querySelector('#liveBtn')?.getAttribute('aria-pressed')==='true',{timeout:12000});
  const blocked=await page.evaluate(()=>({
    title:document.querySelector('#titleBtn')?.textContent?.trim(),
    attempts:window.__geRadioPlayAttempts,
    connected:document.body.classList.contains('ge-radio-audible')
  }));
  // A blocked or not-yet-connected stream must still show no song title.
  if(blocked.connected||(!blocked.title?.includes('Connecting')&&blocked.title!=='Select a song'))
    throw new Error('Radio displayed a song before verified playback: '+JSON.stringify(blocked));
  console.log('PASS: manual RADIO selection does not falsely display a playing song when audio is blocked');
  // Radio 27: a real phone-sized viewport must never horizontally crop or
  // offset the main transport. This regression runs on every Radio HTML push.
  const phone=await browser.newPage();
  await phone.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  for (const width of [375,390,430]) {
    await phone.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:3});
    await phone.goto('http://127.0.0.1:8765/radio/?ge_view=mobile',{waitUntil:'domcontentloaded',timeout:30000});
    await phone.waitForFunction(()=>document.body.classList.contains('view-player')&&
      !!document.querySelector('#bgGroup')&&!!document.querySelector('#bottomActions'),{timeout:12000});
    const rects=await phone.evaluate(()=>{
      const viewport=document.documentElement.clientWidth;
      const names=['.wrap','header','#playerSeekWrap','#musicGroup','#bgGroup','#bottomActions'];
      return {viewport,parts:names.map(name=>{
        const el=document.querySelector(name),r=el?.getBoundingClientRect();
        return {name,left:r?.left,right:r?.right,width:r?.width,center:r?(r.left+r.right)/2:null};
      })};
    });
    const wrong=rects.parts.filter(r=>r.center==null||
      Math.abs(r.center-rects.viewport/2)>2||
      r.left < -2 || r.right > rects.viewport+2);
    if(wrong.length)throw new Error('iPhone Radio off-center at '+width+'px: '+JSON.stringify({wrong,viewport:rects.viewport}));
    console.log('PASS: iPhone Radio controls centered and unclipped at '+width+'px');
  }
  // Safari Request Desktop Website changes the user agent to Macintosh.
  // On physical iPhone hardware the Radio still MUST use the mobile viewport.
  await phone.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15');
  await phone.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:3});
  await phone.goto('http://127.0.0.1:8765/radio/?ge_view=auto',{waitUntil:'domcontentloaded',timeout:30000});
  const safari=await phone.evaluate(()=>({
    mode:document.documentElement.dataset.geDeviceLayout,
    width:document.documentElement.clientWidth,
    meta:document.querySelector('meta[name="viewport"]')?.content,
    center:(()=>{
      const r=document.querySelector('#musicGroup')?.getBoundingClientRect();
      return r?(r.left+r.right)/2:null;
    })()
  }));
  if(safari.mode!=='mobile' || Math.abs(safari.width-390)>2 ||
     !safari.meta?.includes('width=390') ||
     safari.center===null || Math.abs(safari.center-safari.width/2)>2)
    throw new Error('Safari Macintosh UA on iPhone escaped mobile mode: '+JSON.stringify(safari));
  console.log('PASS: iPhone Safari Macintosh desktop-style UA still opens correctly centered mobile Radio');
  await phone.close();
}finally{await browser.close();}
