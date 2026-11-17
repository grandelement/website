import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const [width,height,isMobile] of [[390,844,true],[1440,900,false]]){
  const page=await browser.newPage();
  try{
   await page.setViewport({width,height,isMobile,hasTouch:isMobile,deviceScaleFactor:isMobile?2:1});
   const errors=[];page.on('pageerror',err=>errors.push(String(err?.message||err)));
   await page.goto('http://127.0.0.1:8765/radio/?ge_view='+(!isMobile?'desktop':'mobile'),{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.getElementById('sunLabBtn')&&
     document.getElementById('playBtn')&&window.GEMusicV5?.openOffline&&window.GEOfflineDownloads?.inspect,{timeout:16000});
   const state=await page.evaluate(()=>{
    // Use a test-only unexpired scoped receipt to verify SUN LAB placement.
    // Compare player controls in player mode; desktop may default to Ship.
    document.body.classList.remove('view-ship');
    document.body.classList.add('view-player');
    if(innerWidth<700)document.body.classList.add('portrait-player');
    sessionStorage.removeItem('GE_VAULT_SCOPED_ACCESS_V1');
    window.GERadioSyncOfflineAccess?.();
    const guestSunVisible=!document.getElementById('sunLabBtn').hidden;
    sessionStorage.setItem('GE_VAULT_SCOPED_ACCESS_V1',JSON.stringify({
      verifiedFor:'radio',until:Date.now()+60000,scopes:['radio','sunlab'],sunLab:true
    }));
    window.GERadioSyncOfflineAccess?.();
    const sun=document.getElementById('sunLabBtn'),support=document.querySelector('#geUtilityRow a.bc-btn'),offline=document.getElementById('offlineLaunchBtn');
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,width:r.width}};
    const forbidden=['reloadBtn','geDebugOpen','offlineBtn','geOfflineDecision','offlinePanel'];
    return {bad:forbidden.filter(id=>document.getElementById(id)),guestSunVisible,grantedSunVisible:!sun.hidden,offline:rect(offline),sun:rect(sun),support:rect(support),
      code:!!document.getElementById('accessLaunchBtn'),codeRect:rect(document.getElementById('accessLaunchBtn')),contact:rect(document.getElementById('contactLaunchBtn')),share:rect(document.getElementById('shareBtn')),
      radio:!!document.getElementById('liveBtn'),
      musicButton:!!document.getElementById('geMusicV5Button')};
   });
   assert.deepEqual(state.bad,[],'Old Radio controls returned: '+JSON.stringify(state));
   assert(state.code&&state.radio&&state.musicButton,'Main player controls were lost');
   assert(state.guestSunVisible&&state.grantedSunVisible,'SUN LAB button must remain visible before and after access code');
   assert(state.sun.width>25,'Granted SUN LAB must be visible and tappable');
   if(isMobile){
     const order=[state.sun,state.offline,state.contact,state.support,state.codeRect,state.share];
     assert(order.every((rect,i)=>i===0||order[i-1].right<=rect.left+2),
       'iPhone footer order must be SUN OFFLINE CONTACT BUY CODE SHARE: '+JSON.stringify(state));
     assert(order.every(rect=>Math.abs(rect.width-order[0].width)<2&&Math.abs(rect.top-order[0].top)<2),
       'All six icon utilities must be equally sized in one row');
   }else{
     assert(state.offline.right<=state.support.left+2,'Desktop OFFLINE precedes SUPPORT');
     assert(state.support.right<=state.sun.left+2,'Desktop SUPPORT precedes SUN LAB');
     assert(Math.abs(state.offline.width-state.support.width)<5&&Math.abs(state.support.width-state.sun.width)<5,
       'Desktop utility widths must remain aligned');
   }
   // Rendered CSS, not source-string checks: catch invisible button text and
   // stale dark transport controls on both iPhone and desktop.
   const buttonColors=await page.evaluate(()=>{
     const sample=id=>{
       const el=document.getElementById(id),style=getComputedStyle(el);
       return {id,background:style.backgroundColor,image:style.backgroundImage,
         text:style.color,visible:el.getBoundingClientRect().width>0};
     };
     const loaded=[...document.styleSheets].map(sheet=>sheet.href||'');
     return {loaded,transport:['prevBtn','playBtn','nextBtn'].map(sample),
       share:sample('shareBtn'),code:sample('accessLaunchBtn'),
       contact:sample('contactLaunchBtn')};
   });
   for(const file of ['radio-base.css','radio-components.css','radio-layout.css'])
     assert(buttonColors.loaded.some(url=>url.includes('/radio/'+file)),
       'Missing consolidated CSS file '+file+' '+JSON.stringify(buttonColors.loaded));
   const rgba=value=>(value.match(/[\d.]+/g)||[]).map(Number);
   for(const item of buttonColors.transport){
     const [red,green,blue]=rgba(item.text);
     assert(item.visible&&red>=200&&green>=210&&blue>=210,
       'Transport text/icon color must be legible on every device: '+JSON.stringify(item));
     assert(item.image.includes('linear-gradient'),
       'Transport must retain approved blue player surfaces: '+JSON.stringify(item));
   }
   const [shareRed,shareGreen,shareBlue]=rgba(buttonColors.share.background);
   assert(Math.abs(shareRed-185)<25&&Math.abs(shareGreen-165)<25&&Math.abs(shareBlue-232)<25,
     'SHARE must remain violet: '+JSON.stringify(buttonColors.share));
   for(const item of [buttonColors.code,buttonColors.contact]){
     const [red,green,blue]=rgba(item.text);
     assert(item.visible&&red>=210&&green>=210&&blue>=210,
       'Footer text must be visible on dark controls: '+JSON.stringify(item));
   }
   await page.click('#offlineLaunchBtn');
   await page.waitForFunction(()=>{
     const root=document.getElementById('geMusicV5Host')?.shadowRoot;
     return !!root?.querySelector('.geOfflineWorkspace')&&!root.querySelector('.geOfflineChoices').hidden;
   },{timeout:12000});
   const offlineUI=await page.evaluate(()=>{
     const root=document.getElementById('geMusicV5Host').shadowRoot;
     const view=root.querySelector('.geOfflineWorkspace'),choices=root.querySelector('.geOfflineChoices');
     const labels=[...choices.querySelectorAll('[data-ge-offline]')].map(b=>b.textContent.trim());
     const footer=root.querySelector('.selectionBar'),dock=view.getBoundingClientRect();
     return {labels,downloads:view.querySelectorAll('.geOfflineStart').length,
       dockButtons:view.querySelectorAll('.geOfflineDockToggle').length,
       actualHeight:dock.height,footerVisible:footer.getBoundingClientRect().height>0,
       aboveFooter:dock.bottom<=footer.getBoundingClientRect().top+3,
       otherDialog:!!document.getElementById('geOfflineSurface'),
       musicOpen:window.GEMusicV5.state().open};
   });
   assert.deepEqual(offlineUI.labels,['ALL MUSIC','CHECKED SONGS','PLAYLIST','UPDATE MISSING']);
   assert.equal(offlineUI.downloads,0,'No duplicated full-screen DOWNLOAD button');
   assert.equal(offlineUI.dockButtons,1,'Only one MUSIC OFFLINE dock button');
   assert(offlineUI.actualHeight<100,'OFFLINE must be a compact footer strip');
   assert(offlineUI.footerVisible&&offlineUI.aboveFooter,'Music playback controls remain usable below OFFLINE');
   assert(offlineUI.musicOpen,'OFFLINE must not replace MUSIC');
   assert.equal(offlineUI.otherDialog,false,'No duplicate global offline dialog');
   await page.evaluate(()=>{
     document.getElementById('geMusicV5Host').shadowRoot.querySelector('.geOfflineDockToggle').click();
   });
   await page.waitForFunction(()=>{
     const root=document.getElementById('geMusicV5Host')?.shadowRoot;
     return window.GEMusicV5.state().open&&root.querySelector('.geOfflineChoices').hidden;
   },{timeout:5000});
   await page.evaluate(()=>{
     document.getElementById('geMusicV5Host').shadowRoot.querySelector('.geOfflineDockToggle').click();
   });
   await page.waitForFunction(()=>!document.getElementById('geMusicV5Host')?.shadowRoot?.querySelector('.geOfflineChoices')?.hidden,{timeout:5000});
   const music=await page.evaluate(()=>{
     const root=document.querySelector('#geMusicV5Host').shadowRoot;
     return {offline:root.querySelectorAll('.offlineSelected,.geMusicOfflineRow,.geMusicOfflineTrigger').length,
       reload:root.querySelectorAll('.reloadCatalogBtn').length,
       code:!!root.querySelector('.musicCodeTools'),
       play:!!root.querySelector('.playSelected')};
   });
   assert.equal(music.offline,0,'Retired MUSIC offline duplicate returned');
   assert.equal(music.reload,0,'MUSIC reload button returned');
   assert(music.code&&music.play,'MUSIC code and PLAY preserved');
   if(errors.length)throw Error('Radio JS errors after removal: '+JSON.stringify(errors.slice(0,8)));
   console.log('PASS '+width+'x'+height+': front OFFLINE shows nonblocking four-option dock above Music PLAY/B﻿UY; footer aligned');
  }finally{await page.close();}
 }
}finally{await browser.close();}