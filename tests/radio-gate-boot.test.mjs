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
}finally{await browser.close();}
