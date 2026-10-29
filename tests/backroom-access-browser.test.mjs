import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

const BASE=process.env.GE_TEST_BACKROOM_URL||'http://127.0.0.1:8765/backroom/';
const browser=await puppeteer.launch({
 executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
 headless:true,args:['--no-sandbox','--disable-setuid-sandbox']
});
let page;
try{
 page=await browser.newPage();
 await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:2});
 const errors=[];
 let outage=false;
 const savedFans=[
   {id:'fan_aaaaaaa1',display_name:'Fan One',code_id:'access_test1',code_label:'Test 1'},
   {id:'fan_bbbbbbb2',display_name:'Fan Two',code_id:'access_legacy_love_v1',code_label:'LOVE'}
 ];
 page.on('pageerror',e=>errors.push(String(e?.stack||e)));
 await page.evaluateOnNewDocument(()=>{
   sessionStorage.setItem('GE_BACKROOM_PUBLISH_SESSION_V1','mock-signed-publisher-session');
   sessionStorage.setItem('GE_BACKROOM_ACTIVE_TAB_V1','access');
 });
 await page.setRequestInterception(true);
 page.on('request',req=>{
   const url=req.url();
   if(!url.startsWith('https://ge-backroom-publisher.grandelement.workers.dev/')){
     void req.continue();return;
   }
   const route=new URL(url).pathname;
   let data={ok:true},status=200;
   if(route==='/session')data={ok:true};
   else if(route==='/health')data={ok:true,configured:true,vault_service_bound:true,
     vault_reachable:true,vault_access_codes_ready:true};
   else if(route==='/manage/access-codes'&&outage){
     status=502;data={ok:false,error:'Private Vault disconnected during code read'};
   }
   else if(route==='/manage/access-codes'&&req.method()==='POST'){
     const body=JSON.parse(req.postData()||'{}');
     if(body.action==='reveal'&&body.id==='access_test1')data={
       ok:true,id:'access_test1',action:'reveal',code:'GE-ABCD-1234-4A5B'
     };
     else{status=400;data={ok:false,error:'Unexpected test write'};}
   }
   else if(route==='/manage/access-codes')data={
     ok:true,master_enabled:true,legacy_love:{state:'ACTIVE'},items:[
       {id:'access_test1',label:'Test 1',code_hint:'4A5B',enabled:1,revoked:false,
        scopes:['radio','music','website'],playlist_ids:['playlist_test2'],
        track_paths:['ge-music/music/Grand Element - 2024 - Fire/Fire_06_Smoke.mp3'],
        max_uses:0,use_count:0,duration_mode:'none',
        experience:{games_enabled:true,autopilot_enabled:false,radio_playlist_id:''}},
       {id:'access_legacy_love_v1',label:'LOVE',code_hint:'LOVE',enabled:1,revoked:false,
        scopes:['website','radio','music','albums','games'],playlist_ids:[],track_paths:[],
        max_uses:0,use_count:0,duration_mode:'none',
        experience:{games_enabled:true,autopilot_enabled:true,radio_playlist_id:''}}
     ]};
   else if(route==='/manage/github-playlists')data={ok:true,items:[
     {id:'playlist_test2',name:'Test 2',tracks:[
       {track_path:'ge-music/music/Grand Element - 2024 - Fire/Fire_06_Smoke.mp3',
        track_title:'Smoke',album:'Fire'}]}
   ]};
   else if(route==='/presets')data={ok:true,presets:[]};
   else if(route==='/manage/fan-access'&&req.method()==='POST'){
     const body=JSON.parse(req.postData()||'{}');
     if(body.action==='create'){
       const fan={id:'fan_ccccccc3',display_name:body.display_name,code_id:null,code_label:null};
       savedFans.push(fan);data={ok:true,fan_id:fan.id,display_name:fan.display_name,verified_identity:false};
     }else if(body.action==='assign'){
       const fan=savedFans.find(f=>f.id===body.fan_id);
       if(fan)fan.code_id=body.code_id;
       data={ok:true,fan_id:body.fan_id,code_id:body.code_id};
     }else{status=400;data={ok:false,error:'Unexpected fan write'};}
   }
   else if(route==='/manage/fan-access')data={ok:true,fans:savedFans,recent:[]};
   else{status=404;data={ok:false,error:'Unmocked route: '+route};}
   void req.respond({status,contentType:'application/json',
     headers:{'Access-Control-Allow-Origin':'*',
       'Access-Control-Allow-Headers':'Authorization, Content-Type',
       'Access-Control-Allow-Methods':'GET, POST, OPTIONS'},
     body:JSON.stringify(data)});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:45000});
 try{
   await page.waitForFunction(()=>{
     const el=document.getElementById('brAccessSelect');
     return document.getElementById('brVaultConnection')?.textContent?.includes('CONNECTED') &&
       el && [...el.options].some(o=>o.textContent==='Test 1') &&
       document.getElementById('brAccessEditor')?.hidden===false &&
       document.getElementById('brAccessLoadPrimary')?.disabled!==true;
   },{timeout:25000,polling:250});
 }catch(e){
   const debug=await page.evaluate(()=>({
     vault:document.getElementById('brVaultConnection')?.textContent,
     status:document.getElementById('brAccessStatus')?.textContent,
     options:[...(document.getElementById('brAccessSelect')?.options||[])].map(o=>o.textContent),
     editorHidden:document.getElementById('brAccessEditor')?.hidden,
     hasMusic:!!document.getElementById('brAccessMusicCategory'),
     hasAccess:!!document.querySelector('#brAccessEditor details.brAccessCategory'),
     loggedIn:!document.getElementById('backroomMain')?.classList.contains('hidden')
   }));
   throw Error('Access Codes did not initialize on a real mobile browser: '+
     JSON.stringify(debug)+' PAGE ERRORS '+JSON.stringify(errors.slice(-7)));
 }
 const before=await page.evaluate(()=>({
    vault:document.getElementById('brVaultConnection').textContent,
    codeNames:[...document.getElementById('brAccessSelect').options].map(x=>x.textContent),
    editorHidden:document.getElementById('brAccessEditor').hidden
 }));
 await page.select('#brAccessSelect','access_test1');
 await page.click('#brAccessLoadPrimary');
 await page.evaluate(()=>{
   document.getElementById('brAccessMusicCategory').open=true;
   const access=document.querySelector('#brAccessEditor details.brAccessCategory');
   access.open=true;
 });
 const result=await page.evaluate(()=>({
   name:document.getElementById('brAccessLabel').value,
   musicVisible:document.getElementById('brAccessMusicCategory').open,
   accessVisible:document.querySelector('#brAccessEditor details.brAccessCategory').open,
   hasGames:!!document.getElementById('brCodeGames'),
   hasAutopilot:!!document.getElementById('brCodeAutopilot'),
   hasPersonalPlaylist:!!document.getElementById('brCodeRadioPlaylist'),
   radioPermission:!!document.querySelector('[name="brAccessScope"][value="radio"]'),
   playlistChoice:!!document.getElementById('brAccessPlaylistChoices'),
   errors:[]
 }));
 assert.equal(result.name,'Test 1');
 assert.equal(result.musicVisible,true);
 assert.equal(result.accessVisible,true);
 assert.equal(result.hasGames,false,'crossed-out SHOW GAMES row must not exist');
 assert.equal(result.hasAutopilot,false,'crossed-out AUTOPILOT row must not exist');
 assert.equal(result.hasPersonalPlaylist,false,'crossed-out personal playlist field must not exist');
 assert.equal(result.radioPermission,true,'RADIO permission remains');
 assert.equal(result.playlistChoice,true);
 const identity=await page.evaluate(()=>document.getElementById('brAccessKeyIdentity')?.textContent||'');
 assert.match(identity,/NOT proof of the actual Radio key/,
  'Existing code label must not be presented as a verified Radio key');
 const keySection=await page.evaluate(()=>{
   const control=document.getElementById('brAccessShowActualKey');
   return {exists:!!control,collapsed:control?.closest('details')?.open===false};
 });
 assert.equal(keySection.exists,true,'owner-only reveal control must remain mounted');
 // The owner may have opened the parent ACCESS panel. Secret retrieval is
 // covered by backend unit tests, not an automated click on a hidden UI control.
 assert.equal(await page.evaluate(()=>document.getElementById('brAccessLabel')?.value),'Test 1');
 assert.equal(await page.$eval('#brAccessOfflineShortcut',b=>b.textContent),'OFFLINE');
 await page.click('#brAccessOfflineShortcut');
 assert.equal(await page.evaluate(()=>document.querySelector('[name="brAccessScope"][value="offline"]')?.closest('details')?.open),
  true,'OFFLINE shortcut opens real saved-code permission editor');
 await page.click('#brAccessFansShortcut');
 await page.waitForFunction(()=>document.querySelector('#brCodeFansPanel')?.open===true&&
   document.getElementById('brCodeFanSelect')?.options?.length>=3,{timeout:15000});
 assert.equal(await page.$eval('#brFanActiveProfile',x=>x.hidden),true,
  'Fan settings must stay concealed until a specific Vault profile is loaded');
 await page.type('#brFanProfileSearch','Fan One');
 await page.waitForFunction(()=>document.getElementById('brCodeFanSelect').options.length===2);
 await page.select('#brCodeFanSelect','fan_aaaaaaa1');
 await page.evaluate(()=>{
   const panel=document.querySelector('#brCodeFansPanel');
   [...panel.querySelectorAll('button')].find(x=>x.textContent==='LOAD').click();
 });
 await page.waitForFunction(()=>document.querySelector('#brFanActiveProfile')?.hidden===false);
 const loaded=await page.evaluate(()=>({
   title:document.querySelector('#brFanActiveProfile h3')?.textContent,
   code:document.querySelector('#brCodeFanCode')?.value,
   unrelatedVault:document.querySelector('#brFanPlaylistVault')?.hidden
 }));
 assert.match(loaded.title,/Fan One/);
 assert.equal(loaded.code,'access_test1');
 assert.equal(loaded.unrelatedVault,true,'All-fan playlist list must hide during single-profile view');
 await page.evaluate(()=>{
   const panel=document.querySelector('#brCodeFansPanel');
   [...panel.querySelectorAll('button')].find(x=>x.textContent==='CLOSE PROFILE').click();
 });
 assert.equal(await page.$eval('#brFanActiveProfile',x=>x.hidden),true);
 await page.type('#brFanProfileSearch','Fan Three');
 await page.evaluate(()=>{
   const panel=document.querySelector('#brCodeFansPanel');
   [...panel.querySelectorAll('button')].find(x=>x.textContent==='NEW / SAVE').click();
 });
 await page.waitForFunction(()=>document.querySelector('#brFanActiveProfile h3')?.textContent?.includes('Fan Three'),{timeout:15000});
 assert.equal(await page.$eval('#brCodeFanCode',x=>x.value),'',
  'A new fan profile cannot inherit another fan access code');
 console.log('PASS: ACCESS OFFLINE shortcut and Vault-backed FANS profile search/load/new/close stay isolated.');
 // Simulate a real iPhone with an authenticated owner but failed Vault read.
 outage=true;
 await page.reload({waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>/VAULT · (PARTIAL|OFFLINE|ERROR)/.test(
  document.getElementById('brVaultConnection')?.textContent||''),{timeout:25000});
 const disconnected=await page.evaluate(()=>({
  state:document.getElementById('brVaultConnection')?.textContent,
  status:document.getElementById('brAccessStatus')?.textContent,
  editorVisible:document.getElementById('brAccessEditor')?.hidden===false,
  musicPresent:!!document.getElementById('brAccessMusicCategory'),
  accessPresent:!!document.querySelector('#brAccessEditor details.brAccessCategory'),
  keyDisabled:document.getElementById('brAccessShowActualKey')?.disabled,
  names:[...document.getElementById('brAccessSelect').options].map(x=>x.textContent)
 }));
 assert.ok(disconnected.editorVisible,'Music and Access must remain visible when Vault is down');
 assert.ok(disconnected.musicPresent&&disconnected.accessPresent);
 assert.equal(disconnected.keyDisabled,true,'Unverified codes cannot be revealed');
 assert.ok(disconnected.names.some(n=>/VAULT NOT LOADED/.test(n)));
 assert.match(disconnected.status,/CODES: UNAVAILABLE/);
 assert.deepEqual(errors,[],'Browser reported initialization errors');
 console.log('PASS: Back Room keeps key controls folded and handles Vault outages without hiding Music and Access.',
    JSON.stringify({before,result,disconnected}));
}finally{await browser.close();}
