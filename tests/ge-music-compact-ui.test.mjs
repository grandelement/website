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
    const sun=one('.gePlayerSunReturn'),offline=one('.geOfflineDockToggle');
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
   // ALBUMS is artwork-only. The small OFFLINE dock lives above the song controls.
   const albums=await page.evaluate(()=>{
    const root=document.querySelector('#geMusicV5Host').shadowRoot;
    const universe=root.querySelector('.geStandaloneAlbumUniverse');
    const board=universe.querySelector('.geUniverseAlbums');
    const covers=[...board.querySelectorAll('.geUniverseAlbum')];
    const first=covers[0]?.getBoundingClientRect();
    return {
     visible:universe.classList.contains('isActive'),
     toolbar:!!universe.querySelector('.geUniverseToolbar'),
     lastRemoved:!covers.some(x=>x.dataset.album==='Fundamental Groove'),
     singlesRemoved:!covers.some(x=>/^singles?$/i.test(x.dataset.album)),
     fits:!!first&&first.width>35&&first.width<150&&
      board.scrollHeight<=board.clientHeight+4,
     touches: covers.every((x,i)=>!i||Math.abs(x.getBoundingClientRect().top-
      covers[i-1].getBoundingClientRect().bottom)<=2),
     count:covers.length
    };
   });
   assert(albums.visible&&!albums.toolbar&&albums.lastRemoved&&albums.singlesRemoved&&albums.fits&&albums.touches,
     'ALBUMS must fit all connected covers with no Singles or marked controls: '+JSON.stringify(albums));
   const zoom=await page.evaluate(()=>{
    const root=document.getElementById('geMusicV5Host').shadowRoot;
    const universe=root.querySelector('.geStandaloneAlbumUniverse');
    const board=universe.querySelector('.geUniverseAlbums');
    const first=board.querySelector('.geUniverseAlbum');
    const before=first.getBoundingClientRect().width;
    const dispatch=(name,points)=>{
     const event=new Event(name,{bubbles:true,cancelable:true});
     Object.defineProperty(event,'touches',{value:points.map(([x,y])=>({clientX:x,clientY:y}))});
     universe.dispatchEvent(event);
    };
    dispatch('touchstart',[[140,260],[220,260]]);
    dispatch('touchmove',[[55,260],[305,260]]);
    dispatch('touchend',[]);
    return {before,after:first.getBoundingClientRect().width,
     scrolls:board.scrollHeight>board.clientHeight};
   });
   assert(zoom.after>zoom.before*2&&zoom.scrolls,
    'Pinch must grow actual album covers into a scrollable zoom view: '+JSON.stringify(zoom));
   await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geUniverseAlbum[data-album="Fire"]').click());
   await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.albumDetailTitle')?.textContent==='Fire');
   const pos=await page.evaluate(()=>{
    const r=document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geOfflineDockToggle').getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
   });
   const before=await page.url();
   await page.touchscreen.tap(pos.x,pos.y);
   const after=await page.evaluate(()=>{
    const root=document.querySelector('#geMusicV5Host').shadowRoot;
    const workspace=root.querySelector('.geOfflineWorkspace');
    const choices=root.querySelector('.geOfflineChoices');
    const footer=root.querySelector('.selectionBar');
    return {offline:!!workspace&&getComputedStyle(workspace).display!=='none',
     choices:!!choices&&!choices.hidden,footer:footer.getBoundingClientRect().height>0,
     open:window.GEMusicV5.state().open,url:location.href};
   });
   assert(after.offline&&after.open&&after.choices&&after.footer,
     'OFFLINE expands four choices without hiding MUSIC/PLAY controls');
   assert.equal(after.url,before,'OFFLINE must not redirect');
   console.log('PASS '+width+'px: album covers, mini OFFLINE dock, choices and playable MUSIC bottom row');
  }finally{await page.close()}
 }
}finally{await browser.close()}
