import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';

// Exercise the ACTUAL Back Room navigation initializer, not a hand-arranged
// four-button fixture. That fixture missed SAVE being stranded before FANS.
const back=readFileSync('backroom/index.html','utf8');
const center=readFileSync('backroom/save-center.js','utf8');
const css=readFileSync('backroom/save-center.css','utf8');
const nav=(back.match(/<nav id="backroomTabs"[^>]*>[\s\S]*?<\/nav>/)||[])[0];
const start=back.indexOf('function installBackroomTabs(){');
const stop=back.indexOf('\ninstallBackroomTabs();',start);
assert.ok(nav&&start>=0&&stop>start,'Actual Back Room navigation source must be present.');
const initialize='const $=id=>document.getElementById(id);\n'+back.slice(start,stop)+'\ninstallBackroomTabs();';
const legacyCss=[...back.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
assert.equal((legacyCss.match(/#backroomMain\s+\.backroomTabs\s*\{/g)||[]).length,0,
  'Historical navigation grid patches must be consolidated.');
const tabs=['radio','access','fans','welcome','about','universe','games','moon','gate','scores'];
const children=tabs.map(tab=>{
 const contents=tab==='radio'
   ?'<button id="brRouteSave">SAVE ROUTING</button><p id="brRouteStatus"></p>'+
    '<button id="brPlaylistSave">SAVE PLAYLIST</button><p id="brPlaylistStatus"></p>'
   :tab==='access'
   ?'<div id="brAccessEditor"></div><button id="brAccessIssue">SAVE NEW</button>'+
     '<button id="brAccessSave" hidden>SAVE EDIT</button><p id="brAccessStatus"></p>'
   :tab==='fans'
   ?'<details id="brCodeFansPanel" open><div id="brFanActiveProfile" hidden></div>'+
     '<input id="brFanProfileSearch"><button id="brCreateFan">NEW / SAVE</button>'+
     '<button id="brSaveFanCode">SAVE FAN CODE</button></details>'
   :'';
 return '<section data-br-tab="'+tab+'"><h2>'+tab.toUpperCase()+'</h2>'+contents+'</section>';
}).join('');
const document='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<style>'+legacyCss+'</style><style>'+css+'</style></head><body>'+
 '<main id="backroomMain"><header><div id="brCentralSaveStatus" hidden></div></header>'+
 nav+children+'</main></body></html>';
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox']
});
try{
 const page=await browser.newPage();
 page.on('dialog',dialog=>void dialog.accept());
 await page.setViewport({width:1024,height:800,isMobile:true,deviceScaleFactor:2});
 await page.setContent(document,{waitUntil:'domcontentloaded',timeout:15000});
 await page.addScriptTag({content:initialize});
 await page.evaluate(()=>{
   window.__calls={github:0,radio:0,access:0,fan:0};
   window.GE_BACKROOM_SAVE_PUBLIC_SETTINGS=async()=>{
     window.__calls.github++;
     return {ok:true,commit:'123456789abcdef',paths:['welcome']};
   };
   document.getElementById('brRouteSave').addEventListener('click',()=>window.__calls.radio++);
   document.getElementById('brAccessIssue').addEventListener('click',()=>window.__calls.access++);
   document.getElementById('brSaveFanCode').addEventListener('click',()=>window.__calls.fan++);
 });
 await page.addScriptTag({content:center});
 const navState=await page.evaluate(()=>({
   ids:[...document.querySelector('#backroomTabs').children].map(n=>n.id),
   legacyHidden:document.getElementById('brLegacyTabMount')?.hidden,
   text:document.getElementById('brTopSave')?.textContent,
   fansRect:document.getElementById('brTabFans')?.getBoundingClientRect().toJSON(),
   saveRect:document.getElementById('brTopSave')?.getBoundingClientRect().toJSON()
 }));
 assert.deepEqual(navState.ids,['brTabRadio','brTabAccess','brTabFans','brTopSave'],
   'SAVE must be fourth, immediately to the right of FANS on the desktop.');
 assert.equal(navState.legacyHidden,true);
 assert.equal(navState.text,'SAVE TO GITHUB');
 assert.equal(navState.fansRect.y,navState.saveRect.y);
 assert.ok(navState.saveRect.x>navState.fansRect.x,'SAVE must appear to the right of FANS.');
 await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 const mobile=await page.evaluate(()=>{
   const save=document.getElementById('brTopSave'),fans=document.getElementById('brTabFans');
   const sr=save.getBoundingClientRect(),fr=fans.getBoundingClientRect();
   return {hit:document.elementFromPoint(sr.x+sr.width/2,sr.y+sr.height/2)?.id,
     saveY:sr.y,fansY:fr.y,saveX:sr.x,fansX:fr.x,height:sr.height};
 });
 assert.equal(mobile.hit,'brTopSave','SAVE must not be covered by an old CSS overlay');
 assert.equal(mobile.saveY,mobile.fansY,'SAVE and FANS must share the second row on a phone.');
 assert.ok(mobile.saveX>mobile.fansX&&mobile.height>=54);
 await page.click('#brTopSave');
 assert.equal(await page.evaluate(()=>window.__calls.radio),1);
 await page.click('#brTabAccess');
 await page.waitForFunction(()=>document.getElementById('brTopSave')?.textContent==='SAVE TO VAULT');
 await page.click('#brTopSave');
 assert.equal(await page.evaluate(()=>window.__calls.access),1);
 await page.click('#brTabFans');
 await page.evaluate(()=>document.getElementById('brFanActiveProfile').hidden=false);
 await page.click('#brTopSave');
 assert.equal(await page.evaluate(()=>window.__calls.fan),1);
 await page.click('#brMoreTools > summary');
 await page.click('#brTabWelcome');
 await page.waitForFunction(()=>document.getElementById('brTopSave')?.textContent==='SAVE TO GITHUB');
 await page.click('#brTopSave');
 await page.waitForFunction(()=>window.__calls.github===1);
 assert.match(await page.$eval('#brCentralSaveStatus',e=>e.textContent),/GITHUB VERIFIED/);
 console.log('PASS: actual Back Room init places SAVE right of FANS on desktop and mobile; four controls only; GitHub/Radio/Access/Fan dispatch and More Tools routing correct.');
}finally{await browser.close()}
