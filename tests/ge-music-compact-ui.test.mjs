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
     fitted:!!first&&first.width>30&&first.height>30&&
       board.scrollHeight<=board.clientHeight+3,
     attached:covers.every((cover,i)=>i===0||
       Math.abs(cover.getBoundingClientRect().top-covers[i-1].getBoundingClientRect().bottom)<2),
     singleAbsent:!covers.some(x=>x.dataset.album==='Singles'),
     zoomed:board.style.getPropertyValue('--ge-universe-zoom')
    };
   });
   assert(albums.visible&&!albums.toolbar&&albums.lastRemoved&&albums.fitted&&albums.attached&&albums.singleAbsent&&albums.zoomed==='1',
     'ALBUMS must fit all connected covers in one view, no Singles or marked controls: '+JSON.stringify(albums));
   const zoom=await page.evaluate(()=>{
    const root=document.querySelector('#geMusicV5Host').shadowRoot;
    const board=root.querySelector('.geUniverseAlbums');
    const first=board.querySelector('.geUniverseAlbum');
    const before=first.getBoundingClientRect().width;
    board.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:-400,bubbles:true,cancelable:true}));
    const after=first.getBoundingClientRect().width;
    const scrolls=board.scrollHeight>board.clientHeight;
    board.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:1500,bubbles:true,cancelable:true}));
    return {before,after,scrolls,restored:first.getBoundingClientRect().width};
   });
   assert(zoom.after>zoom.before*2&&zoom.scrolls,
     'Pinch/zoom must enlarge covers into a scrollable close view: '+JSON.stringify(zoom));
   assert(Math.abs(zoom.restored-zoom.before)<3,
     'Pinch back must restore the full compact album view: '+JSON.stringify(zoom));
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
    const dock=workspace.getBoundingClientRect(),bar=workspace.querySelector('.geOfflineDockLine').getBoundingClientRect();
    const options=choices.getBoundingClientRect(),end=footer.getBoundingClientRect();
    const controls=[...choices.querySelectorAll('button[data-ge-offline]')];
    const tappable=controls.every(control=>{
     const box=control.getBoundingClientRect();
     if(box.top<0||box.bottom>innerHeight||box.left<0||box.right>innerWidth)return false;
     const at=root.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
     return at===control||control.contains(at);
    });
    return {offline:!!workspace&&getComputedStyle(workspace).display!=='none',
     choices:!!choices&&!choices.hidden,footer:end.height>0,
     dockBeforeFooter:dock.top>=0&&dock.bottom<=end.top+3,
     optionsInFlow:options.top>=bar.bottom-2&&options.bottom<=dock.bottom+2,
     optionsInViewport:options.top>=0&&options.bottom<=innerHeight,
     actionsCount:controls.length,tappable,
     open:window.GEMusicV5.state().open,url:location.href};
   });
   assert(after.offline&&after.open&&after.choices&&after.footer,
     'OFFLINE expands four choices without hiding MUSIC/PLAY controls');
   assert(after.dockBeforeFooter&&after.optionsInFlow&&after.optionsInViewport&&after.actionsCount===4&&after.tappable,
     'All four OFFLINE actions must be below dock, above PLAY and touchable inside phone viewport: '+JSON.stringify(after));
   assert.equal(after.url,before,'OFFLINE must not redirect');
   console.log('PASS '+width+'px: connected fit albums, pinch closeup, no Singles, mini OFFLINE dock and playable footer');
  }finally{await page.close()}
 }
}finally{await browser.close()}
