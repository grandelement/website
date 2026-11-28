import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const [w,h,mobile] of [[390,844,true],[820,1180,true],[1440,900,false]]){
  const page=await browser.newPage();
  const viewport=async (width,height)=>page.setViewport({width,height,isMobile:mobile,hasTouch:mobile,isLandscape:width>height,deviceScaleFactor:1});
  try{
   await viewport(w,h);
   await page.goto('http://127.0.0.1:8765/radio/?ge_view='+(mobile?'mobile':'desktop')+'&bgper=0&bgauto=0&hudhide=0',{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>window.GEHUD?.resetForView&&window.GEShip&&!document.body.classList.contains('ge-radio-initializing'),{timeout:20000});
   await page.evaluate(()=>{window.GEHUD.setAuto(false);window.GEHUD.setShipAuto(false);window.__rotationBackground=document.getElementById('bgImage');window.__rotationAudio=document.getElementById('player');});
   const check=async mode=>{
    await page.waitForFunction(mode=>{
     const body=document.body;
     return body.classList.contains(mode==='ship'?'view-ship':'view-player')&&body.classList.contains('portrait-player')===(mode==='portrait')&&!body.classList.contains('hud-hidden');
    },{timeout:12000},mode);
    await new Promise(r=>setTimeout(r,1000));
    const state=await page.evaluate(mode=>{
     const el=id=>document.getElementById(id),rect=id=>el(id).getBoundingClientRect();
     const body=document.body,player=mode!=='ship',sun=rect(player?'homeLink':'shipLogo'),bg=el('bgImage');
     const aura=el('sunEQAura'),wrap=el('playBtn').closest('.wrap');
     return {background:bg===window.__rotationBackground,audio:el('player')===window.__rotationAudio,
      hidden:body.classList.contains('hud-hidden'),anchor:aura.parentElement.id,
      width:innerWidth,sunCenter:sun.left+sun.width/2,sunWidth:sun.width,
      scrollX:window.scrollX,wrapOpacity:Number(getComputedStyle(wrap).opacity),
      bgWidth:bg.offsetWidth,bgHeight:bg.offsetHeight,viewportHeight:innerHeight,bgFit:getComputedStyle(bg).objectFit,bgTop:bg.getBoundingClientRect().top,bgBottom:bg.getBoundingClientRect().bottom,bgLeft:bg.getBoundingClientRect().left,bgRight:bg.getBoundingClientRect().right,visibleHeight:window.visualViewport?.height||innerHeight,bleed:getComputedStyle(bg).getPropertyValue('--ge-background-bleed').trim(),
      bgOpacity:Number(getComputedStyle(bg).opacity)};
    },mode);
    assert(state.background&&state.audio,'Rotation must preserve background and audio elements');
    assert(!state.hidden,'Old idle timer must not hide the new frame');
    assert.equal(state.anchor,mode==='ship'?'shipSunEffectAnchor':'homeLink');
    assert(state.sunWidth>0&&state.sunCenter>0&&state.sunCenter<state.width,'Sun must remain inside viewport');
    assert(Math.abs(state.scrollX)<2,'No retained landscape horizontal scroll');
    if(mode!=='ship')assert(state.wrapOpacity>.9,'Player controls must be visible after rotation');
    if(mobile){
      assert(Math.abs(state.bgWidth-state.width-8)<3,'Mobile background must cover viewport width without square overscan');
      assert(Math.abs(state.bgHeight-state.viewportHeight-8)<12,'Mobile background must cover viewport height without square overscan');
      assert.equal(state.bgFit,'cover','Background must preserve intrinsic aspect ratio');
      assert.equal(state.bleed,'4px','Protected edge bleed must survive future changes');
      assert(state.bgTop<=-1&&state.bgLeft<=-1&&state.bgRight>=state.width&&state.bgBottom>=state.visibleHeight,'No exposed viewport edge after rotation');
    }
    console.log('ROTATION '+w+'x'+h+' '+mode+' '+JSON.stringify(state));
    return state;
   };
   if(w<h){
    const initial=await check('portrait');
    await viewport(h,w);const landscape=await check('ship');
    assert(initial.bgWidth<landscape.bgWidth,'Background must fit each orientation, not a fixed square');
    await page.evaluate(()=>document.getElementById('viewToggle').click());await check('landscape-player');
    await page.evaluate(()=>document.getElementById('viewToggle').click());await check('ship');
    await page.evaluate(()=>window.GEHUD.hide());
    await viewport(w,h);await check('portrait');
    await viewport(h,w);await check('ship');
    await viewport(w,h);await check('portrait');
   }else{
    await check('ship');
    await page.evaluate(()=>document.getElementById('viewToggle').click());await check('landscape-player');
    await page.evaluate(()=>document.getElementById('viewToggle').click());await check('ship');
   }
  }finally{await page.close()}
 }
}finally{await browser.close()}
console.log('PASS: phone/tablet orientation round trips and desktop view transitions.');
