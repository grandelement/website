import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
const back=readFileSync('backroom/index.html','utf8');
const center=readFileSync('backroom/save-center.js','utf8');
const css=readFileSync('backroom/save-center.css','utf8');
const actual={
 radio:(back.match(/<button id="brTabRadio"[^>]*>[^<]*<\/button>/)||[])[0],
 access:(back.match(/<button id="brTabAccess"[^>]*>[^<]*<\/button>/)||[])[0],
 fans:(back.match(/<button id="brTabFans"[^>]*>[^<]*<\/button>/)||[])[0],
 save:(back.match(/<button id="brTopSave"[^>]*>[^<]*<\/button>/)||[])[0]
};
for(const key of Object.keys(actual))assert.ok(actual[key],'Missing actual top '+key+' control');
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--disable-setuid-sandbox']});
try{
 const page=await browser.newPage();
 await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 page.on('dialog',d=>void d.accept());
 const document='<html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+
   '<style>#backroomMain .backroomTabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;width:100%;max-width:390px}'+
   '#backroomMain .backroomTabs button{min-height:56px;background:#112b44;color:white;border-radius:10px}</style>'+
   '<style>'+css+'</style></head><body><main id="backroomMain">'+
   '<nav id="backroomTabs" class="backroomTabs" role="tablist">'+
   actual.radio+actual.access+actual.fans+actual.save+'</nav>'+
   '<div id="brCentralSaveStatus" hidden></div>'+
   '<button id="brRouteSave">SAVE ROUTING</button><div id="brRouteStatus"></div>'+
   '<button id="brPlaylistSave">SAVE PLAYLIST</button><div id="brPlaylistStatus"></div>'+
   '<div id="brAccessEditor"></div><button id="brAccessIssue">SAVE NEW</button><button id="brAccessSave" hidden>SAVE EDIT</button>'+
   '<div id="brAccessStatus"></div><details id="brCodeFansPanel" open><section id="brFanActiveProfile" hidden></section>'+
   '<input id="brFanProfileSearch"><button id="brCreateFan">NEW / SAVE</button>'+
   '<button id="brSaveFanCode">SAVE FAN CODE</button></details>'+
   '</main></body></html>';
 await page.setContent(document,{waitUntil:'domcontentloaded',timeout:10000});
 await page.evaluate(()=>{
   for(const tab of document.querySelectorAll('#backroomTabs button[data-tab]'))tab.setAttribute('aria-selected','false');
   window.__calls={github:0,radio:0,access:0,fan:0};
   window.GE_BACKROOM_SAVE_PUBLIC_SETTINGS=async()=>{
     window.__calls.github++;return {ok:true,commit:'123456789abcdef',paths:['welcome']};
   };
   document.getElementById('brRouteSave').addEventListener('click',()=>{window.__calls.radio++});
   document.getElementById('brAccessIssue').addEventListener('click',()=>{window.__calls.access++});
   document.getElementById('brSaveFanCode').addEventListener('click',()=>{window.__calls.fan++});
 });
 await page.addScriptTag({content:center});
 const rect=await page.evaluate(()=>{
   const save=document.getElementById('brTopSave'),fans=document.getElementById('brTabFans');
   const sr=save.getBoundingClientRect(),fr=fans.getBoundingClientRect();
   return {centerHit:document.elementFromPoint(sr.x+sr.width/2,sr.y+sr.height/2)?.id,
     saveWidth:sr.width,saveHeight:sr.height,fansY:fr.y,saveY:sr.y};
 });
 assert.equal(rect.centerHit,'brTopSave','Save must be clickable, not covered by Fans');
 assert.ok(rect.saveHeight>=54,'Save needs a large phone tap target');
 assert.equal(rect.saveY,rect.fansY,'Save must be on the same mobile row as Fans');
 await page.evaluate(()=>{
   const btn=document.getElementById('brTabRadio');
   btn.setAttribute('aria-selected','true');
 });
 await page.click('#brTopSave');
 assert.equal(await page.evaluate(()=>window.__calls.radio),1,'Radio saves its GitHub music routing');
 await page.evaluate(()=>{
   document.getElementById('brTabRadio').setAttribute('aria-selected','false');
   document.getElementById('brTabAccess').setAttribute('aria-selected','true');
 });
 await page.click('#brTopSave');
 assert.equal(await page.evaluate(()=>window.__calls.access),1,'Access saves only to private Vault');
 await page.evaluate(()=>{
   document.getElementById('brTabAccess').setAttribute('aria-selected','false');
   document.getElementById('brTabFans').setAttribute('aria-selected','true');
   document.getElementById('brFanActiveProfile').hidden=false;
 });
 await page.click('#brTopSave');
 assert.equal(await page.evaluate(()=>window.__calls.fan),1,'Loaded fan links save to private Vault');
 await page.evaluate(()=>{
   document.getElementById('brTabFans').setAttribute('aria-selected','false');
   // A More Tools website screen is still represented by a data-tab control.
   const w=document.createElement('button');w.dataset.tab='welcome';w.setAttribute('aria-selected','true');
   document.getElementById('backroomTabs').append(w);
 });
 await page.click('#brTopSave');
 await page.waitForFunction(()=>window.__calls.github===1);
 assert.match(await page.$eval('#brCentralSaveStatus',el=>el.textContent),/GITHUB VERIFIED/);
 console.log('PASS: mobile 2x2 navigation, SAVE beside FANS, independent Github/Radio/Access/Fan dispatch and source readback status.');
}finally{await browser.close();}
