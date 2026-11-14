import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

// MUSIC browsing must not change selected songs or expose checkbox clutter.
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']
});
const page=await browser.newPage();
try {
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!window.GEMusicV5?.open,{timeout:20000});
 await page.evaluate(()=>window.GEMusicV5.open());
 await page.waitForFunction(()=>window.GEMusicV5.state().loaded,{timeout:20000});
 const inspect=()=>page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const windowEl=root.querySelector('.window');
  const visible=node=>node&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0;
  return {
   browse:windowEl.classList.contains('geSimpleSongBrowser'),
   headers:[...root.querySelectorAll('.albumBrowseHeading')].map(x=>x.textContent),
   songs:[...root.querySelectorAll('.song .songLabel')].map(x=>x.textContent),
   checks:[...root.querySelectorAll('.song input[type=checkbox]')].filter(visible).length,
   middleControl:!!root.querySelector('.albumDetailFilter'),
   title:root.querySelector('.albumDetailTitle')?.textContent||'',
   nav:visible(root.querySelector('.albumDetailBack'))&&visible(root.querySelector('.albumDetailPlaylist')),
   footer:visible(root.querySelector('.selectionBar')),
   buyDisabled:root.querySelector('.buySelected')?.disabled,
   playDisabled:root.querySelector('.playSelected')?.disabled,
   art:getComputedStyle(windowEl,'::before').backgroundImage,
   search:root.querySelector('.geBrowseSearch')?.placeholder||'',
   searchVisible:visible(root.querySelector('.geBrowseSearch')),
   saveVisible:visible(root.querySelector('.geBrowseSave')),
   addButtons:[...root.querySelectorAll('.geSongAdd')].filter(visible).length,
   count:window.GEMusicV5.state().count
  };
 });
 const all=await inspect();
 assert(all.browse,'MUSIC must start in the simple songs browser');
 assert.equal(all.headers[0],'Aether','All songs must start with Aether');
 assert(all.headers.includes('Fire'),'All songs must include the subsequent album headings');
 assert(all.songs.length>15,'Full catalog must show more than a single album');
 assert.equal(all.checks,0,'No selection checkboxes may appear in browse mode');
 assert.equal(all.middleControl,false,'No middle album selector may exist');
 assert.equal(all.footer,false,'Browse list must not show disabled BUY/PLAY footer');
 assert(all.nav,'ALBUMS and PLAYLIST must be visible');
 assert(all.searchVisible&&all.saveVisible,'Search and SAVE must always occupy the shared top row');
 assert(all.addButtons>0,'Songs must have one-tap add controls without checkboxes');
 const before=all.count;
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geSongAdd').click());
 assert.equal((await inspect()).count,before+1,'+ must add a song to the working playlist');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geSongAdd.isAdded').click());
 assert.equal((await inspect()).count,before,'Tapping the selected song + must remove it again');
 await page.evaluate(()=>{
  const search=document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geBrowseSearch');
  search.value='Prana';search.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert((await inspect()).songs.every(name=>name.toLowerCase().includes('prana')),'Search must filter songs');
 await page.evaluate(()=>{
  const search=document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geBrowseSearch');
  search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  [...root.querySelectorAll('.albumBrowseHeading')].find(x=>x.textContent==='Aether').click();
 });
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.albumDetailTitle')?.textContent==='Aether');
 const album=await inspect();
 assert(album.browse&&album.songs.length>0,'Album focus must retain simple song browsing');
 assert(album.songs.length<all.songs.length,'Album focus must show only album songs');
 assert.equal(album.checks,0,'Album focus must not have checkboxes');
 assert.equal(album.count,before,'Opening an album must not select songs');
 assert.equal(album.playDisabled,false,'Album PLAY must work without selecting songs');
 assert(album.art.includes('Aether'),'Album focus must use its artwork');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailBack').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelectorAll('.albumBrowseHeading').length>1);
 assert.equal((await inspect()).count,before,'Returning to songs must preserve existing playlist selections');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailBack').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.geStandaloneAlbumUniverse.isActive'));
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  root.querySelector('.geUniverseAlbum[data-album="Fire"]').click();
 });
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.albumDetailTitle')?.textContent==='Fire');
 const fire=await inspect();
 assert(fire.art.includes('Fire'),'Tapping artwork must show the selected album');
 assert.equal(fire.checks,0,'Artwork album browsing must not show checkboxes');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailPlaylist').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.gePlaylistListTitle')?.textContent==='SAVED PLAYLISTS');
 const playlists=await inspect();
 assert(playlists.searchVisible&&playlists.saveVisible,'PLAYLIST must keep search and SAVE in the same location');
 await page.evaluate(()=>{
  const search=document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.geBrowseSearch');
  search.value='test';search.dispatchEvent(new Event('input',{bubbles:true}));
 });
 console.log('PASS simple SONGS listing, + selection, search and SAVE, shared PLAYLIST layout');
} finally {
 await browser.close();
}
