import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox','--disable-setuid-sandbox']
});
try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error?.message||error).slice(0,180)));
  await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
  try{
    await page.waitForFunction(()=>typeof window.GEGate?.openCodeEntry==='function',{timeout:12000});
  }catch(_e){
    throw new Error('Full Radio Gate controller did not boot from this commit. Errors: '+JSON.stringify(errors.slice(-8)));
  }
  if(errors.length)throw new Error('Radio JavaScript boot failed: '+JSON.stringify(errors.slice(-8)));
  console.log('PASS: fresh browser initializes Sun Lab and real Gate controller with zero JavaScript exceptions');
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
