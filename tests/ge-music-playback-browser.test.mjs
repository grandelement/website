import puppeteer from 'puppeteer-core';

// Browser regression for the real MUSIC UI. No real Vault codes or payments.
// A mocked signed session/verification and an inert audio.play() allow checking
// exactly which local recording the Radio controls are asked to start.
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
const song1='ge-music/music/Grand Element - 2026 - Aether/Aether_01_The Journey.mp3';
const song2='ge-music/music/Grand Element - 2026 - Aether/Aether_02-Polaris.mp3';
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:3});
 await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1');
 await page.evaluateOnNewDocument(()=>{
  HTMLMediaElement.prototype.play=function(){
   window.__geTestPlayCalls=(window.__geTestPlayCalls||0)+1;
   this.dispatchEvent(new Event('playing'));
   return Promise.resolve();
  };
 });
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=request.url();
  if(url.includes('/v1/public/access/music-session')){
   void request.respond({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,authorized:true})});return;
  }
  if(url.startsWith('https://api.github.com/repos/grandelement/website/git/trees/')){
   void request.respond({status:503,contentType:'application/json',body:'{}'});return;
  }
  void request.continue();
 });
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.evaluate(({song1,song2})=>{
  localStorage.setItem('GE_MUSIC_V3_SELECTION_20261024',JSON.stringify([song1,song2]));
  sessionStorage.setItem('GE_MUSIC_CODE_SESSION_V1',JSON.stringify({
   token:'QA_MOCKED_SERVER_ONLY',restricted:false,allowed:[],until:Date.now()+120000
  }));
 },{song1,song2});
 await page.reload({waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!window.GEMusicV5?.open&&!!window.GEMusicV5Bridge?.play,{timeout:20000});
 await page.evaluate(()=>window.GEMusicV5.open());
 await page.waitForFunction(()=>window.GEMusicV5.state().loaded&&
  typeof document.querySelector('#geInlineMusicFrame')?.contentWindow?.GEPlayLibraryQueue==='function',
  {timeout:20000});
 const rows=await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host')?.shadowRoot;
  return [...(root?.querySelectorAll('.song')||[])].map(row=>row.querySelector('.songLabel')?.textContent||'');
 });
 if(!rows.includes('Polaris')||!rows.includes('The Journey'))
  throw Error('Aether song titles missing or include redundant album suffix: '+JSON.stringify(rows.slice(0,12)));
 const clickRow=async name=>page.evaluate(name=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const row=[...root.querySelectorAll('.song')].find(r=>r.querySelector('.songLabel')?.textContent===name);
  if(!row)throw Error('Cannot find '+name);
  row.querySelector('.songActions button').click();
 },name);
 const source=()=>page.evaluate(()=>({
  open:window.GEMusicV5.state().open,
  song:document.getElementById('audio')?.getAttribute('src')||
       document.querySelector('#geInlineMusicFrame')?.contentDocument?.getElementById('audio')?.getAttribute('src')||'',
  title:document.querySelector('#titleBtn')?.textContent||'',
  queue:document.querySelector('#gePlaylistQuickToggle')?.textContent||'',
  calls:document.querySelector('#geInlineMusicFrame')?.contentWindow?.__geTestPlayCalls||0
 }));
 await clickRow('Polaris');
 await page.waitForFunction(()=>!window.GEMusicV5.state().open,{timeout:10000});
 let state=await source();
 if(!state.song.includes('Polaris')||!state.title.includes('Polaris')||!state.queue.includes('2 SONGS'))
  throw Error('Clicking Polaris did not close MUSIC and start checked queue: '+JSON.stringify(state));
 // Forward and backward stay inside the checked queue, even after its end.
 await page.click('#nextBtn');
 state=await source();
 if(!state.song.includes('The%20Journey')&&!state.song.includes('The Journey'))
  throw Error('NEXT did not advance checked queue: '+JSON.stringify(state));
 await page.click('#nextBtn');
 state=await source();
 if(!state.song.includes('Polaris'))throw Error('NEXT did not wrap back to Polaris: '+JSON.stringify(state));
 await page.click('#prevBtn');
 state=await source();
 if(!state.song.includes('The%20Journey')&&!state.song.includes('The Journey'))
  throw Error('PREV did not wrap to previous checked song: '+JSON.stringify(state));
 // One checked song loops instead of ending. Changing a checkbox stays local.
 await page.evaluate(()=>window.GEMusicV5.open());
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const row=[...root.querySelectorAll('.song')].find(r=>r.querySelector('.songLabel')?.textContent==='The Journey');
  if(!row)throw Error('The Journey row missing');
  row.querySelector('input[type=checkbox]').click();
 });
 await clickRow('Polaris');
 await page.waitForFunction(()=>!window.GEMusicV5.state().open,{timeout:10000});
 const before=await source();
 await page.evaluate(()=>{
  const audio=document.getElementById('audio')||
    document.querySelector('#geInlineMusicFrame')?.contentDocument?.getElementById('audio');
  if(!audio)throw Error('MUSIC audio element missing');
  audio.dispatchEvent(new Event('ended'));
 });
 const after=await source();
 if(!after.song.includes('Polaris')||after.calls<=before.calls)
  throw Error('One checked song did not repeat on ended: '+JSON.stringify({before,after}));
 console.log('PASS: iPhone SONG rows use title only; row PLAY closes MUSIC, starts tapped song, loops checked queue, and one selected song repeats.');
}finally{await browser.close()}
