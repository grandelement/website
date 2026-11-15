import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
try{
 for(const [width,height,mobile] of [[390,844,true],[1440,900,false]]){
  const page=await browser.newPage();
  try{
   await page.setViewport({width,height,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
   await page.goto('http://127.0.0.1:8765/radio/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>typeof window.GERadioReloadLibrary==='function'&&typeof window.GERadioReloadAllowed==='function'&&typeof window.GEMusicV5?.open==='function',{timeout:20000});
   await page.evaluate(()=>{
    // Exercise the player view in both orientations, not Ship autopilot.
    document.body.classList.remove('view-ship');
    document.body.classList.add('view-player');
    if(innerWidth<700)document.body.classList.add('portrait-player');
    window.GERadioReloadAllowed=()=>true;
    window.GERadioDebugAllowed=()=>true;
    window.geRadioSunLabAllowed=()=>true;
    window.GERadioSyncOfflineAccess?.();
    window.__ownerCallCounts={reload:0,debug:0};
    window.GERadioReloadLibrary=async()=>{window.__ownerCallCounts.reload++;return true;};
    window.GERadioOpenDiagnostics=()=>{window.__ownerCallCounts.debug++;return true;};
    window.GEMusicV5.open();
    window.dispatchEvent(new Event('ge-access-experience-updated'));
   });
   await page.waitForFunction(()=>{
    const root=document.querySelector('#geMusicV5Host')?.shadowRoot;
    return root&&[...root.querySelectorAll('.geMusicOwnerTool')].every(b=>!b.hidden);
   },{timeout:8000});
   const metrics=await page.evaluate(()=>{
    const root=document.querySelector('#geMusicV5Host').shadowRoot;
    const publicRows=[document.getElementById('bottomActions'),document.getElementById('geUtilityRow')];
    const labels=publicRows.flatMap(node=>[...node.querySelectorAll('button,a')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.textContent.trim()));
    const sun=document.querySelector('#geUtilityRow #sunLabBtn');
    const support=document.querySelector('#geUtilityRow a.bc-btn');
    const box=x=>{const r=x.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,cy:r.top+r.height/2};};
    return {
     labels,
     originalOffline:document.getElementById('offlineBtn')?.closest('#geRadioInternalControls')!=null,
     sun:box(sun),support:box(support),
     musicOwnerLabels:[...root.querySelectorAll('.geMusicOwnerTool')].map(b=>({text:b.textContent.trim(),hidden:b.hidden})),
     musicOfflineVisible:getComputedStyle(root.querySelector('.geMusicOfflineTrigger')).display!=='none',
     scrollWidth:document.documentElement.scrollWidth
    };
   });
   for(const label of ['RELOAD','DEBUG','OFFLINE'])assert(!metrics.labels.includes(label),label+' visible on front: '+JSON.stringify(metrics));
   assert(metrics.originalOffline,'Original offline controller must remain off-screen');
   assert(metrics.sun.x+metrics.sun.w<=metrics.support.x+2,'SUN LAB must be left of SUPPORT: '+JSON.stringify(metrics));
   assert(Math.abs(metrics.sun.cy-metrics.support.cy)<4,'SUN LAB and SUPPORT must share the same row');
   assert(metrics.support.right<=width+2,'SUPPORT must remain inside the viewport');
   assert(metrics.musicOfflineVisible,'OFFLINE must be reachable inside MUSIC');
   assert.deepEqual(metrics.musicOwnerLabels.map(x=>x.text),['RELOAD','DEBUG']);
   assert(metrics.musicOwnerLabels.every(x=>!x.hidden),'Owner controls should show with verified permissions');
   await page.evaluate(()=>{
    const root=document.querySelector('#geMusicV5Host').shadowRoot;
    root.querySelectorAll('.geMusicOwnerTool').forEach(b=>b.click());
   });
   await page.waitForFunction(()=>window.__ownerCallCounts.reload===1&&window.__ownerCallCounts.debug===1,{timeout:4000});
   console.log('PASS '+width+'x'+height+' front positions, MUSIC owner functions and OFFLINE reachability');
  }finally{await page.close();}
 }
}finally{await browser.close();}
