import puppeteer from 'puppeteer-core';

// Real local MP3 decoder/playback smoke; no mocked play() or music files.
// Vault authorization is TEST-ONLY and intercepted, never a live credential.
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
const path='ge-music/music/Grand Element - 2026 - Aether/Aether_02-Polaris.mp3';
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:3});
 await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1');
 await page.evaluateOnNewDocument(()=>{
  const play=HTMLMediaElement.prototype.play,pause=HTMLMediaElement.prototype.pause;
  const trace=entry=>{
   (window.__geAudioTrace||(window.__geAudioTrace=[])).push({at:Date.now(),...entry});
  };
  HTMLMediaElement.prototype.play=function(...args){
   trace({action:'play',src:this.src,paused:this.paused,ready:this.readyState,where:location.pathname,stack:Error().stack?.slice(0,450)});
   const result=play.apply(this,args);
   Promise.resolve(result).catch(error=>trace({action:'play-rejected',name:error?.name,message:error?.message,src:this.src,where:location.pathname}));
   return result;
  };
  HTMLMediaElement.prototype.pause=function(...args){
   trace({action:'pause',src:this.src,paused:this.paused,where:location.pathname,stack:Error().stack?.slice(0,600)});
   return pause.apply(this,args);
  };
 });
 await page.setRequestInterception(true);
 page.on('request',r=>{
  if(r.url().includes('/v1/public/access/music-session')){
   // Cross-origin Vault checks also require browser CORS preflight. Without
   // these headers the test itself makes verification fail and pauses audio.
   const headers={
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Cache-Control':'no-store'
   };
   if(r.method()==='OPTIONS')void r.respond({status:204,headers});
   else void r.respond({status:200,headers,contentType:'application/json',
    body:JSON.stringify({ok:true,authorized:true})});
  }else if(r.url().startsWith('https://api.github.com/repos/grandelement/website/git/trees/')){
   void r.respond({status:503,contentType:'application/json',body:'{}'});
  }else void r.continue();
 });
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.evaluate(path=>{
  localStorage.setItem('GE_MUSIC_V3_SELECTION_20261024',JSON.stringify([path]));
  sessionStorage.setItem('GE_MUSIC_CODE_SESSION_V1',JSON.stringify({
    token:'QA_ONLY_INTERCEPTED_BY_BROWSER',restricted:false,allowed:[],until:Date.now()+180000
  }));
 },path);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.GEMusicV5?.open&&!!window.GEMusicV5Bridge,{timeout:20000});
 await page.evaluate(()=>window.GEMusicV5.open());
 await page.waitForFunction(()=>window.GEMusicV5.state().loaded&&
  typeof document.querySelector('#geInlineMusicFrame')?.contentWindow?.GEPlayLibraryQueue==='function',
  {timeout:20000});
 const handle=await page.evaluateHandle(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const row=[...root.querySelectorAll('.song')].find(r=>r.querySelector('.songLabel')?.textContent==='Polaris');
  return row?.querySelector('.songActions button')||null;
 });
 const button=handle.asElement();
 if(!button)throw Error('Polaris PLAY button missing');
 await button.click();
 await page.waitForFunction(()=>!window.GEMusicV5.state().open&&document.getElementById('audio')?.src.includes('Polaris'),
  {timeout:10000});
 try{
  await page.waitForFunction(()=>{
   const audio=document.getElementById('audio');
   return audio&&!audio.paused&&audio.currentTime>0.8;
  },{timeout:30000,polling:250});
 }catch(_){
  const status=await page.evaluate(()=>{
   const audio=document.getElementById('audio');
   return {src:audio?.src,time:audio?.currentTime,paused:audio?.paused,
    error:audio?.error?.message,ready:audio?.readyState,
    radioTitle:document.querySelector('#titleBtn')?.textContent,
    frameStatus:document.querySelector('#geInlineMusicFrame')?.contentWindow?.document?.getElementById('status')?.textContent,
    parentTrace:(window.__geAudioTrace||[]).slice(-14),
    frameTrace:(document.querySelector('#geInlineMusicFrame')?.contentWindow?.__geAudioTrace||[]).slice(-14),
    previewActive:window.GEInlineMusic?.active?.()
   };
  });
  throw Error('Real Polaris MP3 did not advance: '+JSON.stringify(status));
 }
 await page.click('#playBtn');
 await page.waitForFunction(()=>document.getElementById('audio')?.paused===true,{timeout:5000});
 await page.click('#playBtn');
 await page.waitForFunction(()=>document.getElementById('audio')?.paused===false,{timeout:5000});
 console.log('PASS: real Polaris MP3 decoded and advanced after MUSIC PLAY; main Radio PLAY paused and resumed the personal song.');
}finally{await browser.close()}
