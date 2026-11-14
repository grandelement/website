import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

// Real Chromium UI regression against the local website. No payment or audio starts.
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
try {
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!window.GEMusicV5?.open,{timeout:20000});
 await page.evaluate(()=>window.GEMusicV5.open());
 await page.waitForFunction(()=>window.GEMusicV5.state().loaded,{timeout:20000});
 const pre=await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host')?.shadowRoot;
  return {albums:root?.querySelectorAll('.geUniverseAlbum').length||0,oldAllSongs:[...root?.querySelectorAll('.songFilter option')||[]].some(x=>x.textContent==='ALL SONGS')};
 });
 assert(pre.albums>=2,'Album universe must contain multiple albums');
 assert.equal(pre.oldAllSongs,false,'Obsolete ALL SONGS option must not return');
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const album=root.querySelector('.geUniverseAlbum[data-album="Sessions II"]');
  if(!album)throw Error('Sessions II album is missing');
  album.click();
 });
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.window.geAlbumDetailClean .albumDetailFilter')?.parentElement?.querySelector('.albumDetailTitle')?.textContent==='Sessions II');
 const inspect=()=>page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const windowEl=root.querySelector('.window');
  const back=root.querySelector('.albumDetailBack');
  const playlist=root.querySelector('.albumDetailPlaylist');
  const filter=root.querySelector('.albumDetailFilter');
  const header=root.querySelector('.header');
  const tools=root.querySelector('.tools');
  const scroller=root.querySelector('.scroll');
  const buy=root.querySelector('.buySelected');
  const play=root.querySelector('.playSelected');
  const rows=[...root.querySelectorAll('.song')];
  const css=(element,pseudo)=>getComputedStyle(element,pseudo);
  const visible=element=>element&&css(element).display!=='none'&&element.getBoundingClientRect().width>0;
  const art=css(windowEl,'::before').backgroundImage;
  return {
   state:windowEl.classList.contains('geAlbumDetailClean')?'album:'+root.querySelector('.albumDetailTitle')?.textContent:'albums',
   heading:root.querySelector('.albumDetailTitle')?.textContent,
   backVisible:visible(back),playlistVisible:visible(playlist),
   oldHeaderHidden:css(header).display==='none',oldToolsHidden:css(tools).display==='none',
   filterValue:filter?.value,albumCount:rows.length,
   selected:rows.filter(r=>r.querySelector('input[type=checkbox]')?.checked).length,
   art,colors:rows.map(r=>css(r).backgroundImage),
   buyVisible:visible(buy),playVisible:visible(play),
   buyRect:buy.getBoundingClientRect().toJSON(),
   playRect:play.getBoundingClientRect().toJSON(),
   scrollRect:scroller.getBoundingClientRect().toJSON(),
   footerRect:root.querySelector('.selectionBar').getBoundingClientRect().toJSON(),
   viewportWidth:innerWidth,viewportHeight:innerHeight
  };
 });
 const result=await inspect();
 assert.equal(result.state,'album:Sessions II');
 assert(result.backVisible&&result.playlistVisible,'Only clean navigation must remain visible');
 assert(result.oldHeaderHidden&&result.oldToolsHidden,'Old MUSIC chrome must not appear in album detail');
 assert.equal(result.heading,'Sessions II','One large album heading must display the selected album');
 assert.equal(result.filterValue,'','Chooser must display CHANGE ALBUM rather than repeat the heading');
 assert(result.albumCount>0,'Album song list must be populated');
 assert.equal(result.selected,result.albumCount,'Opening album must pre-check its songs');
 assert(result.art.includes('Sessions%20II')||result.art.includes('Sessions II'),'Album image must be the background');
 assert(result.buyVisible&&result.playVisible,'BUY and PLAY must be visible');
 assert(result.buyRect.left>result.viewportWidth/3&&result.playRect.left>result.buyRect.right-4,'BUY/PLAY must be right-aligned');
 assert(result.playRect.right<=result.viewportWidth+2,'PLAY must not overflow the screen');
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  root.querySelector('.scroll').scrollTop=800;
 });
 const afterScroll=await inspect();
 assert(Math.abs(result.footerRect.top-afterScroll.footerRect.top)<2,'BUY/PLAY footer must remain fixed while songs scroll');
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const select=root.querySelector('.albumDetailFilter');
  select.value='album:Aether';
  select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.albumDetailFilter')?.parentElement?.querySelector('.albumDetailTitle')?.textContent==='Aether');
 const aether=await inspect();
 assert.equal(aether.heading,'Aether','Album heading must follow the selected album');
 assert.equal(aether.filterValue,'','Chooser should reset to CHANGE ALBUM after switching');
 assert(aether.art.includes('Aether'),'Switching album must switch artwork');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailBack').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.geStandaloneAlbumUniverse.isActive'));
 assert.equal(errors.length,0,'Browser JavaScript errors: '+errors.slice(0,4).join('; '));
 console.log('PASS mobile album navigation, selections, artwork, footer and returning to albums');
} finally {
 await browser.close();
}