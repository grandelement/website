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
      code:!!document.getElementById('accessLaunchBtn'),
      radio:!!document.getElementById('liveBtn'),
      musicButton:!!document.getElementById('geMusicV5Button')};
   });
   assert.deepEqual(state.bad,[],'Old Radio controls returned: '+JSON.stringify(state));
   assert(state.code&&state.radio&&state.musicButton,'Main player controls were lost');
   assert(state.guestSunVisible&&state.grantedSunVisible,'SUN LAB button must remain visible before and after access code');
   assert(state.sun.width>25,'Granted SUN LAB must be visible and tappable');
   assert(state.offline.right<=state.support.left+2,'OFFLINE must be left of SUPPORT: '+JSON.stringify(state));
   assert(state.support.right<=state.sun.left+2,'SUPPORT must be left of SUN LAB: '+JSON.stringify(state));
   assert(Math.abs(state.offline.width-state.support.width)<5&&Math.abs(state.support.width-state.sun.width)<5,'Footer buttons must use equal columns: '+JSON.stringify(state));
   assert(Math.abs(state.sun.top-state.support.top)<5&&Math.abs(state.offline.top-state.support.top)<5,'All footer controls must stay on one line');
   await page.click('#offlineLaunchBtn');
   await page.waitForFunction(()=>{
     const root=document.getElementById('geMusicV5Host')?.shadowRoot;
     return !!root?.querySelector('.window.geOfflineOpen .geOfflineWorkspace');
   },{timeout:8000});
   const offlineUI=await page.evaluate(()=>{
     const root=document.getElementById('geMusicV5Host').shadowRoot;
     const view=root.querySelector('.geOfflineWorkspace');
     const labels=[...view.querySelectorAll('[data-ge-offline]')].map(b=>b.textContent.trim());
     return {labels,downloads:view.querySelectorAll('.geOfflineStart').length,
       selected:view.querySelector('[data-ge-offline="all"]').getAttribute('aria-pressed'),
       actualHeight:view.getBoundingClientRect().height,otherDialog:!!document.getElementById('geOfflineSurface')};
   });
   assert.deepEqual(offlineUI.labels,['ALL MUSIC','CHECKED SONGS','PLAYLIST','UPDATE MISSING']);
   assert.equal(offlineUI.downloads,1,'There must be only one DOWNLOAD button');
   assert.equal(offlineUI.selected,'true','ALL MUSIC must be the one-click default');
   assert(offlineUI.actualHeight>100,'MUSIC owns a visible offline screen');
   assert.equal(offlineUI.otherDialog,false,'No duplicate global offline dialog');
   await page.evaluate(()=>{
     document.getElementById('geMusicV5Host').shadowRoot.querySelector('.geOfflineBack').click();
   });
   await page.waitForFunction(()=>{
     const root=document.getElementById('geMusicV5Host')?.shadowRoot;
     return window.GEMusicV5?.state?.().open===true&&!root?.querySelector('.window.geOfflineOpen');
   },{timeout:8000});
   // The compact MUSIC strip is a second trigger for this same workspace.
   const mini=await page.evaluate(()=>{
     const root=document.getElementById('geMusicV5Host').shadowRoot;
     const bar=root.querySelector('.geOfflineMiniBar');
     const button=bar?.querySelector('.geOfflineMiniButton');
     const percent=bar?.querySelector('.geOfflineMiniPercent');
     const eta=bar?.querySelector('.geOfflineMiniETA');
     return {visible:!!bar&&bar.getBoundingClientRect().height>0,
       button:button?.textContent.trim(),height:button?.getBoundingClientRect().height,
       percent:percent?.textContent,eta:eta?.textContent};
   });
   assert(mini.visible,'Compact MUSIC offline strip must appear above the selection footer');
   assert.equal(mini.button,'OFFLINE');
   assert(mini.height<40,'Compact shortcut must not enlarge the selection footer');
   assert.match(mini.percent,/^\\d+%$/);
   assert.match(mini.eta,/^(?:--|\\d\\d):\\d\\d$/);
   await page.evaluate(()=>{
     document.getElementById('geMusicV5Host').shadowRoot.querySelector('.geOfflineMiniButton').click();
   });
   await page.waitForFunction(()=>!!document.getElementById('geMusicV5Host')?.shadowRoot.querySelector('.window.geOfflineOpen'),{timeout:8000});
   await page.evaluate(()=>{
     document.getElementById('geMusicV5Host').shadowRoot.querySelector('.geOfflineBack').click();
     document.getElementById('geMusicV5Host').shadowRoot.querySelector('.musicOfflineLaunch').click();
   });
   await page.waitForFunction(()=>!!document.getElementById('geMusicV5Host')?.shadowRoot.querySelector('.window.geOfflineOpen'),{timeout:8000});
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
   console.log('PASS '+width+'x'+height+': front OFFLINE opens MUSIC download chooser; one engine, four options; footer aligned');
  }finally{await page.close();}
 }
}finally{await browser.close();}