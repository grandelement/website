import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const [w,h,mobile] of [[390,844,true],[1440,900,false]]){
  const page=await browser.newPage();
  const errors=[],responses=[];
  page.on('pageerror',x=>errors.push(String(x.message||x)));
  page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url().slice(0,160),status:r.status()})});
  await page.setViewport({width:w,height:h,isMobile:mobile,hasTouch:mobile});
  try{
   const resp=await page.goto('https://grandelement.com/radio/?ge_diag=20261117',{waitUntil:'domcontentloaded',timeout:30000});
   await new Promise(resolve=>setTimeout(resolve,3000));
   const status=await page.evaluate(()=>{
    const e=id=>{const n=document.getElementById(id);if(!n)return null;const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {id,visible:r.width>0&&r.height>0,display:s.display,opacity:s.opacity,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
    const hit=(x,y)=>{const n=document.elementFromPoint(x,y);const a=n?.closest?.('a,button,[role="button"]');return {x,y,top:n?.tagName,id:n?.id,button:a?.id||a?.tagName,href:a?.getAttribute('href')||''}};
    return {url:location.href,title:document.title,bodyClass:document.body.className,readyState:document.readyState,htmlLength:document.documentElement.outerHTML.length,
      items:['geGate','geGateHelp','geGatePanel','geGateAccessForm','bgGroup','musicGroup','playBtn','shuffleBtn','hudCombined','geRadioContactPanel'].map(e),
      links:[...document.querySelectorAll('a[href^="mailto:"]')].map(a=>({text:a.textContent.trim().slice(0,50),box:(()=>{const r=a.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()})),
      hits:[hit(innerWidth/2,innerHeight/2),hit(innerWidth/2,innerHeight*.25),hit(innerWidth/2,innerHeight*.65),hit(innerWidth/2,innerHeight*.9)],
      styles:[...document.styleSheets].map(s=>s.href||'inline').filter(Boolean).slice(0,20),
      errorRecorder:window.__GE_PLAYER_ERRORS?.slice(0,12)||[]
    };
   });
   console.log('LIVE RADIO INSPECTION '+w+'x'+h+' HTTP '+resp?.status()+' '+JSON.stringify(status));
   console.log('LIVE RADIO ERRORS '+w+'x'+h+' '+JSON.stringify(errors));
   console.log('LIVE RADIO FAILED REQUESTS '+w+'x'+h+' '+JSON.stringify(responses.slice(0,20)));
  }catch(e){console.log('LIVE RADIO INSPECTION FAILED '+w+'x'+h+' '+String(e));}
  finally{await page.close();}
 }
}finally{await browser.close();}
