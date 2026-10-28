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
   else if(route==='/manage/fan-access')data={ok:true,fans:[],recent:[]};
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
   playlistChoice:!!document.getElementById('brAccessPlaylistChoices'),
   errors:[]
 }));
 assert.equal(result.name,'Test 1');
 assert.equal(result.musicVisible,true);
 assert.equal(result.accessVisible,true);
 assert.equal(result.hasGames,true);
 assert.equal(result.hasAutopilot,true);
 assert.equal(result.playlistChoice,true);
 const identity=await page.evaluate(()=>document.getElementById('brAccessKeyIdentity')?.textContent||'');
 assert.match(identity,/NOT proof of the actual Radio key/,
  'Existing code label must not be presented as a verified Radio key');
 await page.click('#brAccessShowActualKey');
 await page.waitForFunction(()=>document.getElementById('brAccessCodeValue')?.textContent==='GE-ABCD-1234-4A5B');
 assert.equal(await page.evaluate(()=>document.getElementById('brAccessLabel')?.value),'Test 1');
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
 console.log('PASS: Back Room reveals actual keys and handles Vault outages without hiding Music and Access.',
    JSON.stringify({before,result,disconnected}));
}finally{await browser.close();}
