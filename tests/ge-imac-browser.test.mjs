import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
});
try{
 const page=await browser.newPage();
 await page.setViewport({width:1200,height:800});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e.message||e)));
 await page.setRequestInterception(true);
 page.on('request',req=>{
   const u=req.url(),match=/^https:\/\/grandelement\.com\/dj\/(imac-mixer|imac-uploads|studio-diagnostics)\.js(?:\?.*)?$/.exec(u);
   if(match){const path='dj/'+match[1]+'.js';
     void req.respond({status:200,contentType:'application/javascript',body:fs.readFileSync(path,'utf8')});return}
   if(!u.startsWith('http://127.0.0.1:8765/')){void req.abort();return}
   void req.continue();
 });
 await page.goto('http://127.0.0.1:8765/dj/imac.html?tab=google',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>document.querySelectorAll('#geGoogleWorkTabs button').length===3,{timeout:12000});
 let ui=await page.evaluate(()=>{
   const by=id=>document.getElementById(id);
   const box=id=>{const x=by(id);return x?{top:Math.round(x.getBoundingClientRect().top),
    height:Math.round(x.getBoundingClientRect().height),shown:getComputedStyle(x).display!=='none'}:null};
   return {tabs:[...document.querySelectorAll('#geGoogleWorkTabs button')].map(b=>b.textContent),
    upload:box('geUploadSection'),complete:box('geUploadBigResult'),
    folder:box('geGoogleFilesView'),metadata:box('geGoogleMetadataView'),
    status:box('geGoogleStatusView'),
    repairInStatus:!!by('geGoogleStatusView')?.contains(by('reconnectDriveAuth')),
    radioUpload:!!by('radioUploadCard'),
    filenamePreset:!!by('geFilenamePresets'),
    diagnosticsInStatus:!!by('geGoogleStatusView')?.contains(by('geDiagnostics')),
    link:document.querySelector('#geDriveQuickLinks a')?.href||'',
    pageOverflow:document.documentElement.scrollHeight-window.innerHeight
   };
 });
 assert.deepEqual(ui.tabs,['FILES','METADATA','STATUS']);
 assert.ok(ui.upload?.shown,'Upload must remain visible');
 assert.ok(ui.radioUpload,'Radio upload missing');
 assert.ok(ui.repairInStatus,'Google repair must not be at the bottom of FILES');
 assert.ok(ui.diagnosticsInStatus,'Troubleshooting must be in STATUS');
 assert.ok(ui.folder?.shown,'Files tab should start open');
 await page.evaluate(()=>document.querySelectorAll('#geGoogleWorkTabs button')[1].click());
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('geGoogleMetadataView')).display!=='none');
 assert.ok(await page.$('#geUploadSaveSettings'),'Metadata save missing');
 assert.ok(await page.$('#geUploadCoverFile'),'Cover art selector missing');
 await page.evaluate(()=>document.querySelectorAll('#geGoogleWorkTabs button')[2].click());
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('geGoogleStatusView')).display!=='none');
 assert.ok(await page.$('#reconnectDriveAuth'),'Fix Google Drive missing');
 const severe=errors.filter(e=>!/Failed to fetch|NetworkError/i.test(e));
 assert.equal(severe.length,0,'Unexpected script error: '+severe.join(' | '));
 console.log('PASS GE DJ Booth iMac V10 browser DOM tabs and STATUS layout',JSON.stringify(ui));
}finally{await browser.close()}
