import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

// Regression for the requested flow: ALBUMS -> cover -> complete list at album,
// unobtrusive unselected rows, and still-working native selection checkboxes.
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage();
try{
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>!!window.GEMusicV5?.open,{timeout:20000});
 await page.evaluate(()=>window.GEMusicV5.open());
 await page.waitForFunction(()=>window.GEMusicV5.state().loaded,{timeout:20000});
 const inspect=()=>page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const win=root.querySelector('.window');
  const scroll=root.querySelector('.scroll');
  const visible=node=>node&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0;
  const rows=[...root.querySelectorAll('.scroll .song')];
  const headings=[...root.querySelectorAll('.scroll .albumBrowseHeading')];
  const first=headings[0];
  return {
   albums:!!root.querySelector('.geStandaloneAlbumUniverse.isActive'),
   browse:win.classList.contains('geSimpleSongBrowser'),
   headings:headings.map(x=>x.textContent),
   songs:rows.map(x=>x.querySelector('.songLabel')?.textContent),
   selected:rows.filter(x=>x.classList.contains('selectedSong')).length,
   visibleBoxes:rows.filter(x=>visible(x.querySelector('input[type=checkbox]'))).length,
   divider:rows[0]?getComputedStyle(rows[0]).borderBottomWidth:null,
   firstHeadingOffset:first?Math.round(first.getBoundingClientRect().top-scroll.getBoundingClientRect().top):null,
   nav:visible(root.querySelector('.albumDetailBack'))&&visible(root.querySelector('.albumDetailPlaylist')),
   search:visible(root.querySelector('.geBrowseSearch')),
   save:visible(root.querySelector('.geBrowseSave')),
   plusButtons:rows.filter(x=>visible(x.querySelector('.geSongAdd'))).length,
   count:window.GEMusicV5.state().count
  };
 });
 assert((await inspect()).albums,'MUSIC must open in ALBUMS cover view');
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const album=root.querySelector('.geUniverseAlbum[data-album="Fire"]');
  if(!album)throw Error('Fire cover not found');
  album.click();
 });
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelectorAll('.scroll .albumBrowseHeading').length>2);
 await new Promise(r=>setTimeout(r,250));
 const listing=await inspect();
 assert(listing.browse,'Clicking an album must open song browsing');
 assert.equal(listing.headings[0],'Aether','Aether must be first in the complete song list');
 assert(listing.headings.includes('Fire')&&listing.headings.includes('Soul'),'Other albums must remain above and below');
 assert(listing.songs.length>15,'Album click must not filter to one album');
 assert.equal(listing.visibleBoxes,0,'No checkboxes should appear when no rows are selected');
 assert.equal(listing.divider,'0px','Song dividers must not extend across the row');
 assert(listing.search&&listing.save&&listing.nav,'Top actions must stay visible');
 const fireOffset=await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const list=root.querySelector('.scroll');
  const fire=[...root.querySelectorAll('.albumBrowseHeading')].find(x=>x.textContent==='Fire');
  return Math.round(fire.getBoundingClientRect().top-list.getBoundingClientRect().top);
 });
 assert(Math.abs(fireOffset)<85,'Cover click must scroll to selected album, got offset '+fireOffset);
 const before=listing.count;
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const row=root.querySelector('.scroll .song');
  row.querySelector('.geSongAdd').click();
 });
 const selected=await inspect();
 assert.equal(selected.count,before+1,'Tap + must keep working playlist selection');
 assert(selected.visibleBoxes>=1,'Selected row must reveal its native checkbox');
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const checkbox=root.querySelector('.scroll .song.selectedSong input[type=checkbox]');
  if(!checkbox)throw Error('Selected checkbox missing');
  checkbox.click();
 });
 const cleared=await inspect();
 assert.equal(cleared.count,before,'Unchecking must remove selection');
 assert.equal(cleared.visibleBoxes,0,'Checkbox must disappear after deselection');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailPlaylist').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.gePlaylistListTitle')?.textContent==='SAVED PLAYLISTS');
 const playlist=await inspect();
 assert(playlist.search&&playlist.save,'PLAYLIST must keep shared SEARCH and SAVE');
 console.log('PASS initial ALBUMS, full songs at selected cover, no dividers, quiet checkboxes, selection, playlist toolbar');
}finally{await browser.close()}
