import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try{
 for(const [width,height,mobile] of [[390,844,true],[375,667,true],[1440,900,false]]){
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.setViewport({width,height,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
   await page.goto('http://127.0.0.1:8765/radio/?ge_view=mobile',{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>!!document.getElementById('shuffleBtn')&&!!document.getElementById('bgPrev'),{timeout:15000});
   await page.evaluate(()=>{
    document.body.classList.remove('view-ship','hud-hidden');
    document.body.classList.add('view-player');
    if(innerWidth<700)document.body.classList.add('portrait-player');
    window.GEHUD?.setAuto?.(false);
    window.GEHUD?.show?.();
   });
   const elements=await page.evaluate(()=>{
    const ids=['prevBtn','playBtn','nextBtn','shuffleBtn','liveBtn','bgPrev','bgOff','bgNext','bgPer','bgShuf','hudCombined','hudAutoHide','contactLaunchBtn','accessLaunchBtn','shareBtn'];
    return ids.map(id=>{
     const el=document.getElementById(id);
     if(!el)return {id,missing:true};
     el.scrollIntoView({block:'center',inline:'nearest'});
     const rect=el.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
     const above=document.elementFromPoint(x,y),control=above?.closest?.('a,button,input,[role="button"]');
     const style=getComputedStyle(el);
     return {id,rect:{x:Math.round(x),y:Math.round(y),w:Math.round(rect.width),h:Math.round(rect.height)},display:style.display,visible:style.visibility,opacity:style.opacity,hit:control?.id||control?.tagName,href:control?.getAttribute?.('href')||'',topElement:above?.outerHTML?.slice(0,150)};
    });
   });
   console.log('RADIO HIT MAP '+width+'x'+height+' '+JSON.stringify(elements));
   console.log('RADIO PAGE ERRORS '+width+'x'+height+' '+JSON.stringify(errors.slice(0,15)));
   results.push({width,height,intercepted:elements.filter(x=>x.href?.startsWith('mailto:')),missing:elements.filter(x=>x.missing),pageErrors:errors});
  }catch(e){console.log('RADIO TEST ERROR '+width+'x'+height+' '+String(e));process.exitCode=1;}finally{await page.close();}
 }
}finally{await browser.close();}
if(results.some(x=>x.intercepted.length))process.exitCode=1;
console.log('RADIO DIAGNOSTIC SUMMARY '+JSON.stringify(results));
