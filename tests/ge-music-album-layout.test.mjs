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
  const visible=node=>{if(!node)return false;const style=getComputedStyle(node),r=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0.01&&r.width>3&&r.height>3;};
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
   publicCountBanner:root.querySelector('.geBrowseMessage')?.textContent||'',
   count:window.GEMusicV5.state().count
  };
 });
 assert((await inspect()).albums,'MUSIC must open in ALBUMS cover view');
 // AETHER uses the same full-album browser as Fire and every other album.
 // Its twelve existing MP3 paths must never be silently reduced by a stale
 // Back Room assignment, a legacy script, or a competing CSS overlay.
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const album=root.querySelector('.geUniverseAlbum[data-album="Aether"]');
  if(!album)throw Error('Aether cover not found');
  album.click();
 });
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.albumDetailTitle')?.textContent==='Aether');
 const aether=await inspect();
 const expectedAether=['The Journey I','The Journey II','The Journey III','Gravity',
  'Free Energy','Prana','Nexus','Polaris','Conduit','Peace','Aether','Starlight'];
 assert.deepEqual(aether.songs,expectedAether,'AETHER must display all 12 existing recordings in source order, even with duplicate filename numbers');
 assert.equal(new Set(aether.songs).size,12,'AETHER must not duplicate any Journey or omit a distinct recording');
 const aetherScroll=await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const list=root.querySelector('.scroll'),rows=[...list.querySelectorAll('.song')];
  list.scrollTop=list.scrollHeight;
  const last=rows.at(-1)?.getBoundingClientRect(),viewport=list.getBoundingClientRect();
  return {overflow:getComputedStyle(list).overflowY,scrollHeight:list.scrollHeight,
   clientHeight:list.clientHeight,lastVisible:!!last&&last.top>=viewport.top-2&&last.bottom<=viewport.bottom+4,
   lastLabel:rows.at(-1)?.querySelector('.songLabel')?.textContent};
 });
 assert(['auto','scroll'].includes(aetherScroll.overflow),'Album song list needs its own scroll area');
 assert(aetherScroll.lastVisible,'Final AETHER track Starlight must be reachable by scrolling: '+JSON.stringify(aetherScroll));
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailBack').click());
 await page.waitForFunction(()=>!!document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.geStandaloneAlbumUniverse.isActive'));
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const album=root.querySelector('.geUniverseAlbum[data-album="Fire"]');
  if(!album)throw Error('Fire cover not found');
  album.click();
 });
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.albumDetailTitle')?.textContent==='Fire');
 await new Promise(r=>setTimeout(r,250));
 const listing=await inspect();
 assert(listing.browse,'Clicking an album must show song browsing');
 assert.equal(listing.headings.length,0,'Album focus must not show other album headings');
 assert(listing.songs.length>0,'The selected album must show its tracks');
 assert(listing.songs.length<30,'Album focus should be shorter than complete catalog');
 assert.equal(listing.divider,'0px','Song rows must not show dividers');
 assert(listing.search&&listing.save&&listing.nav,'Search, SAVE and navigation must stay visible');
 assert(!/\b\d+\s+SONGS\b/.test(listing.publicCountBanner),'Public song total must stay private');
 assert.equal(listing.visibleBoxes,0,'Unselected songs must have no visible checkboxes');
 const before=listing.count;
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  root.querySelector('.scroll .song .songTitlePlay').click();
 });
 const selected=await inspect();
 assert.equal(selected.count,before+1,'Tap a song title to select it into the working playlist');
 assert.equal(selected.visibleBoxes,0,'Compact song browser never exposes redundant checkboxes');
 const marked=await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  const node=root.querySelector('.scroll .song.selectedSong .geSongTitleGlow');
  return {present:!!node,background:node?getComputedStyle(node).backgroundColor:''};
 });
 assert(marked.present&&marked.background!=='rgba(0, 0, 0, 0)',
  'Selected song title must have its visible highlighted state');
 await page.evaluate(()=>{
  const root=document.querySelector('#geMusicV5Host').shadowRoot;
  root.querySelector('.scroll .song.selectedSong .songTitlePlay').click();
 });
 const cleared=await inspect();
 assert.equal(cleared.count,before,'Unselecting by title restores the original selection');
 assert.equal(cleared.visibleBoxes,0,'Compact track list must remain free of redundant checkboxes');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailSongs').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelectorAll('.albumBrowseHeading').length>2);
 const all=await inspect();
 assert.equal(all.headings[0],'Aether','SONGS opens all albums starting with Aether');
 assert(all.headings.includes('Fire'),'SONGS includes the chosen album and others');
 await page.evaluate(()=>document.querySelector('#geMusicV5Host').shadowRoot.querySelector('.albumDetailPlaylist').click());
 await page.waitForFunction(()=>document.querySelector('#geMusicV5Host')?.shadowRoot?.querySelector('.gePlaylistListTitle')?.textContent==='SAVED PLAYLISTS');
 const playlist=await inspect();
 assert(playlist.search&&playlist.save,'PLAYLIST must keep shared SEARCH and SAVE');
 console.log('PASS initial ALBUMS, album-only songs, SONGS all catalog, quiet left selection, no public counts');
}finally{await browser.close()}
