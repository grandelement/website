import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
const base=process.env.GE_SITE_TEST_URL||'http://127.0.0.1:8765/';
const config=JSON.parse(readFileSync('config/site-live.json','utf8'));
config.merchandise={
  size:115,speed:250,rotation:150,direction:'reverse',quantity:2,
  entryDirection:'right',entryTiming:'fixed',entryMinSeconds:19,entryMaxSeconds:19
};
const browser=await puppeteer.launch({
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox','--disable-setuid-sandbox']
});
try{
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
  await page.setRequestInterception(true);
  page.on('request',request=>{
    if(new URL(request.url()).pathname.endsWith('/config/site-live.json')){
      void request.respond({status:200,contentType:'application/json',
        headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},
        body:JSON.stringify(config)});
    }else void request.continue();
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.GE_SITE_CONFIG?.merchandise,{timeout:20000});
  const report=await page.evaluate(()=>{
    const wrap=document.getElementById('sunWrap');
    const btn=document.getElementById('btnMusic');
    const label=document.getElementById('aboutBtn');
    const shirt=document.querySelector('.geMerchFlyby--shirt');
    const hat=document.querySelector('.geMerchFlyby--hat');
    const root=document.documentElement;
    return {
      sunWidth:wrap.getBoundingClientRect().width,
      musicFont:parseFloat(getComputedStyle(btn).fontSize),
      aboutFont:parseFloat(getComputedStyle(label).fontSize),
      musicBorder:getComputedStyle(btn).borderTopWidth,
      cssTransit:root.style.getPropertyValue('--ge-merch-transit'),
      scale:root.style.getPropertyValue('--ge-merch-scale'),
      spin:root.style.getPropertyValue('--ge-merch-spin'),
      hatSpin:root.style.getPropertyValue('--ge-merch-hat-spin'),
      direction:root.style.getPropertyValue('--ge-merch-direction'),
      shirtDuration:getComputedStyle(shirt).animationDuration,
      hatDuration:getComputedStyle(hat).animationDuration,
      count:document.querySelectorAll('#geMerchFlybys .geMerchFlyby').length
    };
  });
  console.log('MOBILE SUN AND MERCH SETTINGS',JSON.stringify(report));
  assert.ok(report.sunWidth>=111&&report.sunWidth<=114,'Sun visually enlarged about 12% on phone');
  assert.equal(report.musicFont,13);
  assert.equal(report.aboutFont,10);
  assert.equal(report.musicBorder,'0px');
  assert.equal(report.cssTransit,'44s');
  assert.equal(report.scale,'1.15');
  assert.equal(report.spin,'32s');
  assert.equal(report.hatSpin,'36s');
  assert.equal(report.direction,'reverse');
  assert.equal(report.shirtDuration,'44s');
  assert.equal(report.hatDuration,'44s');
  assert.equal(report.count,2);
  console.log('PASS: mobile Blue Sun typography and artwork remain proportional; saved merchandise speed size and rotation reach actual animated elements.');
}finally{await browser.close();}
