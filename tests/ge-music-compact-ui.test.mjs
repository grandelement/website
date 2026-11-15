import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
const manifest=JSON.parse(readFileSync('radio/manifest.json','utf8'));
const tracks=manifest.files.filter(p=>p.startsWith('ge-music/music/')&&/[.](mp3|m4a|wav|ogg)$/i.test(p));
assert(tracks.some(p=>p.includes(' - Fire/')),'Fire album should exist');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const width of [375,390,430]){
  const page=await browser.newPage();
  try{
   await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
   await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>!!window.GEMusicV5?.open,{timeout:20000});
   await page.evaluate(paths=>{window.GEMusicV5.acceptRadioCatalog(paths);window.GEMusicV5.open();},tracks);
   await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailBack').click());
   await page.waitForFunction(()=>!!document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.geUniverseAlbum[data-album="Fire"]'));
   await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geUniverseAlbum[data-album="Fire"]').click());
   await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.albumDetailTitle')?.textContent==='Fire');
   const ui=await page.evaluate(()=>{
    const root=document.querySelector('#geMusicV5Host').shadowRoot,one=s=>root.querySelector(s);
    const toolbar=[one('.geBrowseSearch'),...root.querySelectorAll('.geBrowseTools button')];
    const box=el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,l:r.left,r:r.right}};
    const b=toolbar.map(box),hit=el=>{const p=box(el);const at=root.elementFromPoint(p.x,p.y);return at===el||el.contains(at)};
    const sun=one('.gePlayerSunReturn'),offline=one('.musicOfflineLaunch');
    return {title:one('.albumDetailTitle').textContent,tab:one('.albumDetailSongs').textContent,
      delta:Math.max(...b.map(v=>v.y))-Math.min(...b.map(v=>v.y)),
      inside:b.every(v=>v.l>=-1&&v.r<=innerWidth+1),toolbarHits:toolbar.map(hit),
      countHidden:getComputedStyle(one('.checkedCount')).display==='none',
      sun:box(sun),sunHit:hit(sun),sunVisible:sun.getBoundingClientRect().width>35,
      offline:box(offline),offlineHit:hit(offline),offlineVisible:getComputedStyle(offline).display!=='none'};
   });
   assert.equal(ui.title,'Fire');assert.equal(ui.tab,'FIRE');
   assert(ui.delta<=3&&ui.inside&&ui.toolbarHits.every(Boolean),'Search/SAVE/LOAD/DELETE must be same row, tappable: '+JSON.stringify(ui));
   assert(ui.countHidden&&ui.sunVisible&&ui.sunHit,'Mini Sun must replace count and receive taps');
   assert(ui.offlineVisible&&ui.offlineHit,'OFFLINE must be available even when locked');
   await page.touchscreen.tap(ui.sun.x,ui.sun.y);
   await page.waitForFunction(()=>window.GEMusicV5?.state()?.open===false,{timeout:3000});
   await page.evaluate(()=>window.GEMusicV5.open());
   const pos=await page.evaluate(()=>{
    const r=document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geUniverseOfflineLaunch').getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
   });
   const before=await page.url();
   await page.touchscreen.tap(pos.x,pos.y);
   const after=await page.evaluate(()=>{
    const root=document.querySelector('#geMusicV5Host').shadowRoot;
    const workspace=root.querySelector('.window.geOfflineOpen .geOfflineWorkspace');
    return {offline:!!workspace&&getComputedStyle(workspace).display!=='none',
     open:window.GEMusicV5.state().open,url:location.href};
   });
   assert(after.offline&&after.open,'OFFLINE opens the one MUSIC download workspace');
   assert.equal(after.url,before,'OFFLINE must not redirect');
   console.log('PASS '+width+'px: compact toolbar, album title, blue Sun, shared MUSIC OFFLINE');
  }finally{await page.close()}
 }
}finally{await browser.close()}
