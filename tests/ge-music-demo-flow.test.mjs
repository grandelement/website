import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({
 executablePath:'/usr/bin/google-chrome',
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
try{
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForFunction(()=>!!window.GEDemoCheckout&&!!window.GEMusicV5,{timeout:20000});
 // This test token is local, ephemeral and ONLY unlocks a client-side simulation.
 // It cannot redeem against Vault or make a real purchase.
 await page.evaluate(()=>{
  sessionStorage.setItem('GE_MUSIC_CODE_SESSION_V1',JSON.stringify({
    token:'TEST_ONLY_NOT_A_REAL_VAULT_RECEIPT_123',
    restricted:false,allowed:[],until:Date.now()+120000
  }));
 });
 const eligible=await page.evaluate(()=>window.GEDemoCheckout.authorizedMusic());
 if(!eligible)throw Error('Synthetic all-music checkout eligibility did not work');
 const path='ge-music/music/Grand Element - 2026 - Aether/Aether_01_The Journey.mp3';
 await page.evaluate(path=>window.GEDemoCheckout.open({mode:'tracks',paths:[path]}),path);
 await page.waitForFunction(()=>document.querySelector('#geDemoContent')?.innerText.includes('REVIEW SELECTED MUSIC'),{timeout:15000});
 const initial=await page.$eval('#geDemoContent',e=>e.innerText);
 if(!initial.includes('The Journey')||!initial.includes('SUBTOTAL'))throw Error('Review did not show selected track');
 await page.evaluate(()=>[...document.querySelectorAll('#geDemoContent button')].find(b=>b.textContent.includes('NEXT · PAYMENT')).click());
 await page.waitForFunction(()=>document.querySelector('#geDemoContent')?.innerText.includes('SIMULATED PAYMENT'));
 await page.evaluate(()=>[...document.querySelectorAll('#geDemoContent button')].find(b=>b.textContent.includes('MAKE TEST PAYMENT')).click());
 await page.waitForFunction(()=>document.querySelector('#geDemoContent')?.innerText.includes('PAYMENT MADE · SIMULATION'));
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('GE_MUSIC_TEST_PURCHASES_V1')||'[]'));
 if(stored.length!==1||stored[0].status!=='SIMULATED_NOT_PAID'||stored[0].paths[0]!==path){
  throw Error('Local TEST ONLY receipt not saved correctly');
 }
 await page.evaluate(()=>[...document.querySelectorAll('#geDemoContent button')].find(b=>b.textContent.includes('CONTINUE · FILE DELIVERY')).click());
 await page.waitForFunction(()=>document.querySelector('#geDemoFormat')!==null);
 await page.select('#geDemoFormat','AIFF');
 const methods=await page.$$('#geDemoContent select');
 if(methods.length!==2)throw Error('Delivery options missing');
 await page.evaluate(()=>{
  const mode=document.querySelectorAll('#geDemoContent select')[1];mode.value='both';mode.dispatchEvent(new Event('change'));
  document.querySelector('#geDemoContent input[type=email]').value='test@example.com';
  [...document.querySelectorAll('#geDemoContent button')].find(b=>b.textContent.includes('PREVIEW MY DELIVERY')).click();
 });
 const summary=await page.$eval('#geDemoContent',e=>e.innerText);
 if(!summary.includes('TEST EMAIL PREVIEW')||!summary.includes('Conversion to AIFF has NOT run')||!summary.includes('DOWNLOAD DEMO ORDER MANIFEST')){
  throw Error('Format/email delivery preview missing or incorrectly claims conversion');
 }
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('GE_MUSIC_TEST_PURCHASES_V1')||'[]'));
 if(saved[0]?.deliveryFormat!=='AIFF'||saved[0]?.deliveryOption!=='both')throw Error('Requested delivery format not stored');
 if(errors.length)console.log('Nonfatal page errors from live radio/browser:',errors.slice(0,4));
 console.log('PASS: catalog review, simulated checkout, TEST ONLY receipt, AIFF choice, email preview and manifest. NO CHARGES.');
}finally{await browser.close()}
