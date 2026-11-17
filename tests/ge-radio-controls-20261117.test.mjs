import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {readFileSync} from 'node:fs';

// Protect the single, user-facing music control's two legal labels.
// RADIO and private I AM audio have their own separate controls.
const radio=readFileSync('radio/index.html','utf8');
assert.match(radio,/id="playBtn"[^>]*>PLAYER<\/button>/);
assert.match(radio,/playButton\.textContent=geInlineMusicPaused\?'PLAYER':'PAUSE'/);
assert.match(radio,/playBtn\.textContent=activeSong\?'PAUSE':'PLAYER'/);
assert.doesNotMatch(radio,/playButton\.textContent=geInlineMusicPaused\?'PLAY'/);
assert.doesNotMatch(radio,/playBtn\.textContent=activeSong\?'PAUSE':resumableSong\?'PLAY'/);

const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
try{
 for(const [width,height,isMobile] of [[390,844,true],[375,667,true],[1440,900,false]]){
  const page=await browser.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.message||error)));
  try {
   await page.setViewport({width,height,isMobile,hasTouch:isMobile,deviceScaleFactor:isMobile?2:1});
   await page.goto('http://127.0.0.1:8765/radio/?ge_view=mobile',{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.getElementById('hudAutoHide')&&document.getElementById('shuffleBtn')&&
     !document.body.classList.contains('ge-radio-initializing'),{timeout:16000});
   await page.evaluate(()=>{
    document.body.classList.remove('view-ship','hud-hidden','sun-faded');
    document.body.classList.add('view-player');
    if(innerWidth<700)document.body.classList.add('portrait-player');
   });
   const get=()=>page.evaluate(()=>{
    const ids=['prevBtn','playBtn','nextBtn','shuffleBtn','bgPer','bgShuf','bgPrev','hudCombined','hudAutoHide','contactLaunchBtn','accessLaunchBtn','shareBtn'];
    const ret={};
    for(const id of ids){
      const el=document.getElementById(id),r=el.getBoundingClientRect(),s=getComputedStyle(el);
      const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
      ret[id]={width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,outline:s.outlineColor,outlineWidth:s.outlineWidth,
        background:s.backgroundColor,image:s.backgroundImage,font:s.fontSize,pressed:el.getAttribute('aria-pressed'),checked:el.checked||false,
        hit:hit?.closest('button,a,input,[role="button"]')?.id||hit?.tagName,
        href:hit?.closest('a')?.getAttribute('href')||''};
    }
    return ret;
   });
   let first=await get();
   const label=await page.$eval('#playBtn',button=>button.textContent.trim());
   assert.equal(label,'PLAYER','Idle music control must always say PLAYER');
   console.log('CONTROL_BASE '+width+'x'+height+' '+JSON.stringify(first));
   if(isMobile){
     const ui=await page.evaluate(()=>{
       const box=el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);
         return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,display:style.display};
       };
       const tool=document.getElementById('geUtilityRow');
       const elements=[
         document.getElementById('sunLabBtn'),document.getElementById('offlineLaunchBtn'),
         document.getElementById('contactLaunchBtn'),tool.querySelector('a.bc-btn'),
         document.getElementById('accessLaunchBtn'),document.getElementById('shareBtn')
       ];
       return {sun:box(document.querySelector('header .logo-wrap')),
         song:box(document.getElementById('titleBtn')),
         seek:box(document.getElementById('playerSeekWrap')),
         music:box(document.getElementById('musicGroup')),
         musicRows:getComputedStyle(document.getElementById('musicGroup')).gridTemplateRows,
         musicChildren:[...document.getElementById('musicGroup').children].map(el=>({id:el.id,display:getComputedStyle(el).display,row:getComputedStyle(el).gridRowStart,height:el.getBoundingClientRect().height})),
         bgQuick:box(document.getElementById('geBgQuickRow')),
         bgPanel:box(document.getElementById('bgGroup')),
         bottom:elements.map(box),allIcons:elements.every(el=>!!el.querySelector('svg.ge-radio-icon')),
         viewport:innerHeight,scroll:document.documentElement.scrollHeight};
     });
     console.log('ICON_DOCK '+width+'x'+height+' '+JSON.stringify(ui));
     const near=(a,b,d=1)=>Math.abs(a-b)<=d;
     assert(ui.sun.top>=14,'Sun EQ needs top clearance');
     assert(ui.song.bottom<ui.seek.top,'Song title belongs above the artwork');
     assert(ui.seek.top<ui.music.top,'Progress bar must sit above lower music controls');
     assert(ui.music.bottom<=ui.bgQuick.top,'Background row must be BELOW music');
     assert.equal(ui.musicRows,'43px 43px','One compact two-row MUSIC height contract');
     assert(ui.musicChildren.filter(el=>['prevBtn','playBtn','nextBtn','shuffleBtn','liveBtn','geMusicV5Button'].includes(el.id)).every(el=>Math.abs(el.height-43)<=1),
       'No button-specific music height overrides may compete: '+JSON.stringify(ui.musicChildren));
     assert(ui.bgQuick.bottom<ui.bottom[0].top,'Background row must be ABOVE utilities');
     assert.equal(ui.bgPanel.display,'none','Background details hidden by default');
     assert(ui.allIcons,'All six utilities must have outlined SVG icons');
     for(let i=0;i<6;i++){
       const a=ui.bottom[i],firstBtn=ui.bottom[0];
       assert(near(a.top,firstBtn.top)&&near(a.height,firstBtn.height),
         'Six buttons must share one aligned row: '+JSON.stringify(ui));
       assert(near(a.height,42),'Six icons must share 42px height');
       if(i)assert(a.left>=ui.bottom[i-1].right-1,'Wrong button order: '+JSON.stringify(ui));
     }
     assert(ui.bottom[5].right<=width,'Bottom row must stay inside phone width');
     assert(ui.bottom[0].top<ui.viewport-15||ui.scroll>ui.viewport,'Bottom row must remain reachable');
     if(height>=740)assert(ui.seek.top-ui.song.bottom>=50,
       'Keep at least 50px of center art visible: '+JSON.stringify(ui));
     await page.evaluate(()=>{
       window.__geQuickObserved={prev:0,next:0};
       document.getElementById('bgPrev').addEventListener('click',()=>window.__geQuickObserved.prev++,true);
       document.getElementById('bgNext').addEventListener('click',()=>window.__geQuickObserved.next++,true);
     });
     await page.click('#geBgQuickPrev');
     await page.click('#geBgQuickNext');
     const counts=await page.evaluate(()=>window.__geQuickObserved);
     assert.equal(counts.prev,1,'Previous icon should call existing background control');
     assert.equal(counts.next,1,'Next icon should call existing background control');
     await page.click('#geBgQuickOptions');
     const panel=await page.evaluate(()=>({
       expanded:document.getElementById('geBgQuickOptions').getAttribute('aria-expanded'),
       display:getComputedStyle(document.getElementById('bgGroup')).display
     }));
     assert.equal(panel.expanded,'true');
     assert.notEqual(panel.display,'none','Background options must open existing settings');
     first=await get();
   }
   assert(first.hudAutoHide.width>=27.5&&first.hudAutoHide.height>=27.5,
       'Hide Text checkbox must be 28px on every view: '+JSON.stringify(first.hudAutoHide));
   assert(first.hudAutoHide.right+3<=first.hudCombined.right,
       'Hide Text checkbox must fit within its parent');
   assert(first.hudAutoHide.left>=first.hudCombined.left,
       'Hide Text checkbox must stay inside the button');
   for(const id of ['playBtn','shuffleBtn','bgPrev','hudCombined','contactLaunchBtn']){
     assert(!first[id].href.startsWith('mailto:'),'An email link is intercepting '+id);
   }
   assert(first.playBtn.height>=first.bgPrev.height+1,'Music must be taller than backgrounds on every screen');
   assert(first.playBtn.height>=first.contactLaunchBtn.height+1,'Music must be taller than utilities on every screen');
   const green=color=>/rgb\(0, 255, 168\)/.test(color);
   for(const id of ['bgPer','bgShuf']){
     assert.equal(green(first[id].outline),first[id].pressed==='true',
       id+' green border must match activated background mode');
   }
   assert.equal(green(first.hudCombined.outline),!!first.hudAutoHide.checked,
     'Hide Text green must match native checkbox');
   // Actual click: ensure native change remains functional and does not open email.
   await page.click('#hudAutoHide');
   let second=await get();
   assert.notEqual(second.hudAutoHide.checked,first.hudAutoHide.checked);
   assert.equal(green(second.hudCombined.outline),!!second.hudAutoHide.checked,
      'Hide Text green border did not follow checkbox');
   await page.click('#hudAutoHide');
   let third=await get();
   assert.equal(third.hudAutoHide.checked,first.hudAutoHide.checked);
   assert.equal(green(third.hudCombined.outline),!!third.hudAutoHide.checked);
   // Real Shuffle toggle, testing both directions.
   assert.equal(green(third.shuffleBtn.outline),third.shuffleBtn.pressed==='true',
      'Shuffle green border must match actual pressed mode initially');
   await page.click('#shuffleBtn');
   const fourth=await get();
   assert.notEqual(fourth.shuffleBtn.pressed,third.shuffleBtn.pressed);
   assert.equal(green(fourth.shuffleBtn.outline),fourth.shuffleBtn.pressed==='true',
      'Shuffle green border must follow mode');
   await page.click('#shuffleBtn');
   const fifth=await get();
   assert.equal(fifth.shuffleBtn.pressed,third.shuffleBtn.pressed);
   assert.equal(green(fifth.shuffleBtn.outline),fifth.shuffleBtn.pressed==='true');
   assert.equal(pageErrors.length,0,'Runtime errors: '+JSON.stringify(pageErrors));
   console.log('CONTROL_PASS '+width+'x'+height+' '+JSON.stringify({
     checkbox:first.hudAutoHide.width, music:first.playBtn.height,background:first.bgPrev.height,
     utility:first.contactLaunchBtn.height,shuffle:[third.shuffleBtn.pressed,fourth.shuffleBtn.pressed,fifth.shuffleBtn.pressed],
     greenCheckbox:[first.hudCombined.outline,second.hudCombined.outline],
     errors:pageErrors.length
   }));
  }finally {await page.close();}
 }
}finally {await browser.close();}
