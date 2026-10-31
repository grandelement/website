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
 await page.waitForFunction(()=>document.querySelectorAll('.geGoogleWorkTabs button').length===3,{timeout:12000}).catch(async e=>{
  console.error('DIAGNOSTIC',JSON.stringify(await page.evaluate(()=>({
    errors:document.body?.textContent?.slice(0,700),
    scripts:[...document.scripts].map(s=>s.src).filter(Boolean),
    docks:[...document.querySelectorAll('[class*=geGoogle]')].slice(0,15).map(x=>({class:x.className,id:x.id}))
  })),errors));
  throw e;
 });
 let ui=await page.evaluate(()=>{
   const by=id=>document.getElementById(id);
   const box=id=>{const x=by(id)||document.querySelector("."+id);return x?{top:Math.round(x.getBoundingClientRect().top),
    height:Math.round(x.getBoundingClientRect().height),shown:getComputedStyle(x).display!=='none'}:null};
   return {tabs:[...document.querySelectorAll('.geGoogleWorkTabs button')].map(b=>b.textContent),
    upload:box('geUploadSection'),complete:box('geUploadBigResult'),
    folder:box('geGoogleFilesView'),metadata:box('geGoogleMetadataView'),
    status:box('geGoogleStatusView'),
    repairInStatus:!!by('geGoogleStatusView')?.contains(by('reconnectDriveAuth')),
    radioUpload:!!by('radioUploadCard'),
    filenamePreset:!!by('geFilenamePresets'),
    diagnosticsInStatus:!!by('geGoogleStatusView')?.contains(by('geDiagnostics')),
    link:document.querySelector('#geDriveQuickLinks a')?.href||'',
    pageOverflow:document.documentElement.scrollHeight-window.innerHeight,
    documentScroll:getComputedStyle(document.documentElement).overflowY,
    bodyScroll:getComputedStyle(document.body).overflowY
   };
 });
 assert.deepEqual(ui.tabs,['FILES','METADATA','STATUS']);
 assert.ok(ui.upload?.shown,'Upload must remain visible');
 assert.ok(ui.radioUpload,'Radio upload missing');
 assert.ok(ui.repairInStatus,'Google repair must not be at the bottom of FILES');
 assert.ok(ui.diagnosticsInStatus,'Troubleshooting must be in STATUS');
 assert.ok(ui.folder?.shown,'Files tab should start open');
 assert.equal(ui.bodyScroll,'hidden','Google mode must not scroll the whole webpage at normal window sizes');
 assert.equal(ui.documentScroll,'hidden','Google mode must lock document scrolling at normal window sizes');
 await page.evaluate(()=>document.querySelectorAll('.geGoogleWorkTabs button')[1].click());
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('geGoogleMetadataView')).display!=='none');
 assert.ok(await page.$('#geUploadSaveSettings'),'Metadata save missing');
 assert.ok(await page.$('#geUploadCoverFile'),'Cover art selector missing');
 // Artwork is attached to FINAL products, not automatic on DRAFT.
 await page.click('.gePresetMode[data-mode="final"]');
 await page.waitForFunction(()=>document.querySelectorAll('#geAlbumCoverPicker .geAlbumCoverTile').length===5,{timeout:6000});
 const fireSelector='#geAlbumCoverPicker .geAlbumCoverTile[title="Use Fire artwork from GE Studios GitHub"]';
 await page.waitForFunction(selector=>{
  const image=document.querySelector(selector+' img');
  return !!image&&image.complete&&image.naturalWidth>0;
 },{timeout:9000},fireSelector);
 await page.click(fireSelector);
 const album=await page.evaluate(()=>{
  const s=window.GEImacUploadSettings;
  return {album:document.getElementById('geTagalbumValue').value,
    current:document.getElementById('geAlbumCoverSelected').textContent,
    storedBeforeSave:s.settings().coverPath,
    selected:document.querySelector('.geAlbumCoverTile.geAlbumCoverActive')?.title||'',
    coverCount:s.albumCovers().length
  };
 });
 assert.equal(album.album,'Fire','Selecting album image must fill Album metadata');
 assert.equal(album.current,'SELECTED: Fire');
 assert.equal(album.coverCount,11);
 assert.equal(album.storedBeforeSave,'','Album choice must only become active after SAVE SETTINGS');
 await page.click('#geUploadSaveSettings');
 const savedCover=await page.evaluate(()=>{
   const prefs=window.GEImacUploadSettings;
   return {cover:prefs.coverFor(),album:prefs.settings().fields.album.value,
     status:document.getElementById('geUploadSettingsStatus').textContent};
 });
 assert.equal(savedCover.cover.name,'Grand Element - Fire.jpg');
 assert.equal(savedCover.album,'Fire');
 assert.ok(savedCover.cover.url.startsWith('/ge-images/images/Grand%20Element'));
 assert.ok(savedCover.status.includes('SAVED ON THIS IMAC'));
 await page.evaluate(()=>document.querySelectorAll('.geGoogleWorkTabs button')[2].click());
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('geGoogleStatusView')).display!=='none');
 assert.ok(await page.$('#reconnectDriveAuth'),'Fix Google Drive missing');
 assert.ok(await page.$('#checkLocalHelperInStatus'),'Local health must be tested through page origin');
 // Firefox must be allowed to scroll *inside* STATUS, while the page remains fixed.
 const scrollTest=await page.evaluate(()=>{
  const box=document.getElementById('geGoogleStatusView'),nested=document.getElementById('geDiagnostics');
  const bottom=document.getElementById('checkLocalHelperInStatus');
  box.scrollTop=box.scrollHeight;
  const r=box.getBoundingClientRect(),b=bottom.getBoundingClientRect();
  return {overflow:getComputedStyle(box).overflowY,
    fullHeight:box.scrollHeight,visibleHeight:box.clientHeight,
    bottomButtonVisible:b.top>=r.top&&b.bottom<=r.bottom,
    nestedOverflow:getComputedStyle(nested).overflowY,
    scrolled:box.scrollTop};
 });
 assert.equal(scrollTest.overflow,'auto','STATUS must independently scroll');
 assert.ok(scrollTest.visibleHeight>=90,'STATUS viewport must have space for tools');
 assert.ok(scrollTest.bottomButtonVisible,
   'Bottom diagnostics remain inaccessible even after scrolling: '+JSON.stringify(scrollTest));
 assert.ok(scrollTest.nestedOverflow!=='hidden','Nested diagnostics are still clipped');
 await page.setViewport({width:1024,height:700});
 await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
 const small=await page.evaluate(()=>{
  const box=document.getElementById('geGoogleStatusView');
  const dockTop=document.querySelector('.geBottomDock').getBoundingClientRect().top;
  const panelBottom=document.getElementById('geTabGoogle').getBoundingClientRect().bottom;
  const inside=(node)=>{
   const r=box.getBoundingClientRect(),b=node.getBoundingClientRect();
   return b.top>=r.top-2&&b.bottom<=r.bottom+2;
  };
  box.scrollTop=0;
  const repair=document.getElementById('reconnectDriveAuth');
  const repairVisibleOnOpen=inside(repair);
  const local=document.getElementById('checkLocalHelperInStatus');
  local.scrollIntoView({block:'center'});
  const localVisibleAfterScroll=inside(local),middleScroll=box.scrollTop;
  const advanced=document.getElementById('geDriveExtras');
  advanced.scrollIntoView({block:'end'});
  return {scroll:box.scrollTop,middleScroll,visible:box.clientHeight,
   repairVisibleOnOpen,localVisibleAfterScroll,advancedVisibleAfterScroll:inside(advanced.querySelector('summary')),
   dockTop,panelBottom};
 });
 assert.ok(small.repairVisibleOnOpen,'FIX GOOGLE DRIVE must be immediately visible on STATUS: '+JSON.stringify(small));
 assert.ok(small.localVisibleAfterScroll,'CHECK LOCAL HELPER must be reachable inside STATUS: '+JSON.stringify(small));
 assert.ok(small.advancedVisibleAfterScroll,'Advanced troubleshooting must be reachable inside STATUS: '+JSON.stringify(small));
 assert.ok(small.panelBottom<=small.dockTop+2,'Google content is behind bottom dock: '+JSON.stringify(small));
 const severe=errors.filter(e=>!/Failed to fetch|NetworkError/i.test(e));
 assert.equal(severe.length,0,'Unexpected script error: '+severe.join(' | '));
 console.log('PASS GE DJ Booth iMac V10 browser DOM tabs and STATUS layout',JSON.stringify(ui));
}finally{await browser.close()}
