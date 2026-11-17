import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {readFileSync} from 'node:fs';

const radioSource=readFileSync('radio/index.html','utf8');
assert.match(radioSource,/id="playBtn"[^>]*>PLAYER<\/button>/,'PLAYER is the idle label');
assert.match(radioSource,/playButton\.textContent=geInlineMusicPaused\?'PLAYER':'PAUSE'/,'Inline songs use PLAYER / PAUSE');
assert.match(radioSource,/playBtn\.textContent=activeSong\?'PAUSE':'PLAYER'/,'Native songs use PLAYER / PAUSE');

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
   console.log('CONTROL_BASE '+width+'x'+height+' '+JSON.stringify(first));
   const footer=await page.evaluate(()=>{
     const rect=element=>{
       const r=element.getBoundingClientRect();
       return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,centerY:r.top+r.height/2};
     };
     const row1=['accessLaunchBtn','contactLaunchBtn','shareBtn'].map(id=>rect(document.getElementById(id)));
     const row2=[document.getElementById('offlineLaunchBtn'),document.querySelector('#geUtilityRow a.bc-btn'),document.getElementById('sunLabBtn')].map(rect);
     return {row1,row2,first:rect(document.getElementById('bottomActions')),second:rect(document.getElementById('geUtilityRow')),label:document.getElementById('playBtn').textContent.trim()};
   });
   console.log('FOOTER_GEOMETRY '+width+'x'+height+' '+JSON.stringify(footer));
   const vertical=await page.evaluate(()=>{
     const box=id=>{
       const r=document.getElementById(id)?.getBoundingClientRect();
       return r?{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}:null;
     };
     const logo=document.querySelector('header .logo-wrap')?.getBoundingClientRect();
     const music=box('musicGroup'),backgrounds=box('bgGroup');
     const copyright=document.getElementById('radioCopyright')?.getBoundingClientRect();
     return {viewport:innerHeight,logo:logo?{top:logo.top,bottom:logo.bottom,height:logo.height}:null,
       music,backgrounds,gap:backgrounds.top-music.bottom,footer:box('geUtilityRow'),
       copyrightBottom:copyright?.bottom,canScroll:document.documentElement.scrollHeight>innerHeight};
   });
   console.log('RADIO_VERTICAL '+width+'x'+height+' '+JSON.stringify(vertical));
   if(isMobile){
     assert(vertical.logo?.top>=20&&vertical.logo?.height>=115,
       'Leave safe Blue Sun / EQ room at the top: '+JSON.stringify(vertical));
     assert(vertical.gap>=28,
       'Protect a visible middle gap between MUSIC and BACKGROUNDS: '+JSON.stringify(vertical));
     assert(first.playBtn.height<=41&&first.playBtn.height>=39,
       'Use balanced 40px portrait MUSIC buttons: '+JSON.stringify(first.playBtn));
     assert(first.bgPrev.height<=36&&first.bgPrev.height>=33,
       'Background controls must be smaller than MUSIC: '+JSON.stringify(first.bgPrev));
     assert(vertical.footer.bottom<=vertical.viewport-30||vertical.canScroll,
       'Bottom actions cannot be clipped; allow vertical scrolling on short screens: '+JSON.stringify(vertical));
   }
   assert.equal(footer.label,'PLAYER','Idle music button must read PLAYER');
   const close=(a,b,tolerance=2)=>Math.abs(a-b)<=tolerance;
   if(isMobile){
     assert(close(footer.first.left,footer.second.left)&&close(footer.first.right,footer.second.right),
       'Both public footer rows must have the same outer edges: '+JSON.stringify(footer));
     for(let i=0;i<3;i++){
       assert(close(footer.row1[i].left,footer.row2[i].left)&&close(footer.row1[i].width,footer.row2[i].width),
         'CODE/CONTACT/SHARE and OFFLINE/SUPPORT/SUN LAB must align by column: '+JSON.stringify(footer));
     }
     for(const row of [footer.row1,footer.row2]){
       assert(row.every(btn=>close(btn.height,row[0].height,1)&&close(btn.top,row[0].top,1)),
         'Footer controls in each row must have matching heights and tops: '+JSON.stringify(footer));
     }
     assert(close(footer.row1[0].height,footer.row2[0].height,1),
       'Both public footer rows must have the same button height');
     assert(footer.row2[0].top>footer.row1[0].bottom,
       'OFFLINE/SUPPORT/SUN LAB must appear immediately below CODE/CONTACT/SHARE');
   }else{
     const controls=[...footer.row1,...footer.row2];
     assert(controls.every(btn=>close(btn.height,controls[0].height,1)),
       'Desktop utility controls must share a standard button height: '+JSON.stringify(footer));
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
