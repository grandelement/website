/* GE Radio OFFLINE V2: UI orchestrator. No new audio player, no Vault calls on playback. */
(()=>{
'use strict';
const manager=window.GERadioOfflineManager;
const surface=document.getElementById('geOfflineSurface');
if(!manager||!surface)return;
const STATUS='GE_RADIO_OFFLINE_ACTIVATED_V1',PLAN='GE_RADIO_OFFLINE_PLAN_V1';
const BG_CACHE='ge-radio-backgrounds-v1';
const find=id=>surface.querySelector('#'+id);
const say=message=>{const el=find('geOfflineStatus');if(el)el.textContent=String(message)};
const isInstalled=()=>!!(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true);
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const online=()=>navigator.onLine!==false;
const bridge=()=>window.GERadioOfflineBridge||{};
const hasPermission=()=>bridge().canDownload?.()===true;
const plan=()=>{try{const p=JSON.parse(localStorage.getItem(PLAN)||'null');return Array.isArray(p?.paths)?p.paths:[]}catch(_){return []}};
const active=()=>{try{return localStorage.getItem(STATUS)==='yes'}catch(_){return false}};
window.GEOffline={isActive:active};
let busy=false,stopping=false;
const existing=surface.querySelector('.geOfflineActions');
if(!existing)return;
const buttons=(label,action)=>{
 const b=document.createElement('button');
 b.type='button';b.dataset.offline=action;b.textContent=label;return b;
};
const prepare=buttons('PREPARE FOR OFFLINE','prepare'),reload=buttons('RELOAD / UPDATE','reload');
const repair=buttons('CHECK & REPAIR','repair'),install=buttons('HOME SCREEN SETUP','install');
const oldVerify=existing.querySelector('[data-offline="verify"]');
const stop=existing.querySelector('[data-offline="stop"]');
existing.prepend(prepare,reload,repair);
if(oldVerify){oldVerify.textContent='CHECK READINESS';existing.insertBefore(oldVerify,stop)}
existing.insertBefore(install,stop);
const advanced=document.createElement('details');advanced.id='geOfflineManage';
const summary=document.createElement('summary');summary.textContent='MANAGE MUSIC & DOWNLOADS';
summary.style.cssText='cursor:pointer;padding:12px 5px;font-weight:800';
const inner=document.createElement('div');inner.className='geOfflineActions';
for(const id of ['selected','all','art','delete']){
 const button=existing.querySelector('[data-offline="'+id+'"]');
 if(button)inner.append(button);
}
advanced.append(summary,inner);existing.after(advanced);
const style=document.createElement('style');
style.id='ge-offline-control-v2-styles';
style.textContent='.geOfflineDialog>.geOfflineActions>[data-offline="prepare"]{grid-column:1/-1;background:#0d5b89;font-size:16px;min-height:55px}#geOfflineManage{margin:12px 0 0;border-top:1px solid #356180}#geOfflineManage .geOfflineActions{margin-top:0}';
document.head.append(style);
const installLine=document.createElement('p');installLine.id='geOfflineInstalled';
installLine.className='geOfflineNote';installLine.setAttribute('aria-live','polite');
surface.querySelector('.geOfflineMeter')?.before(installLine);
function updateInstallLine(){
 installLine.textContent=(isInstalled()?'HOME SCREEN APP':'SAFARI / BROWSER TAB')+
  ' · '+(online()?'ONLINE':'OFFLINE')+
  (active()?' · DOWNLOADED LIBRARY ACTIVE':'');
}
function requireInstalled(){
 if(isIOS()&&!isInstalled()){
  say('Install Radio from Safari: Share → Add to Home Screen → Add. Open the NEW Radio icon while online, then choose PREPARE. Safari tab downloads do not automatically transfer.');
  return false;
 }
 return true;
}
function permission(){
 if(hasPermission())return true;
 say('Enter CODE online to authorize downloads. After downloading, local music and the public SUN LAB do not ask for CODE again.');
 surface.hidden=true;
 bridge().promptCode?.();
 return false;
}
async function worker(){
 if(!('serviceWorker' in navigator))throw Error('Service workers not supported');
 let reg=await navigator.serviceWorker.getRegistration('./');
 if(!reg&&online())reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
 if(!reg)throw Error('Start Radio online once to install the offline engine');
 if(!reg.active&&online()){
  try{await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,5000))])}catch(_){}
  reg=await navigator.serviceWorker.getRegistration('./')||reg;
 }
 return reg;
}
async function shellStatus(){
 try{
  const reg=await worker();
  const sw=reg.active||navigator.serviceWorker.controller||reg.waiting;
  if(!sw)return {ready:false,missing:['No active startup worker']};
  return await new Promise(resolve=>{
   const channel=new MessageChannel();
   let handled=false;
   const done=result=>{if(handled)return;handled=true;clearTimeout(timer);resolve(result);channel.port1.close()};
   const timer=setTimeout(()=>done({ready:false,missing:['Engine check timed out; reopen Radio online']}),4800);
   channel.port1.onmessage=e=>done(e.data||{ready:false,missing:['Empty engine response']});
   try{sw.postMessage({type:'GE_RADIO_SHELL_STATUS'},[channel.port2])}
   catch(error){done({ready:false,missing:[String(error?.message||error)]})}
  });
 }catch(error){return {ready:false,missing:[String(error?.message||error)]}}
}
async function onSaved(result){
 if(!result?.saved||result.stopped)return;
 const shell=await shellStatus();
 if(shell.ready){
  try{localStorage.setItem(STATUS,'yes')}catch(_){}
  updateInstallLine();
 }
}
async function readiness({quiet=false}={}){
 const shell=await shellStatus();
 const planned=plan();
 let saved=0;
 for(const path of planned){
  try{if(await manager.anySaved(manager.fileURL(path)))saved++}catch(_){}
 }
 const installed=!isIOS()||isInstalled();
 const stations=await stationStatus();
 const ready=!!shell.ready&&planned.length>0&&saved===planned.length&&stations.total>0&&stations.saved===stations.total&&active()&&installed;
 const result={ready,engine:!!shell.ready,saved,total:planned.length,stations,missing:shell.missing||[],installed};
 updateInstallLine();
 find('geOfflineMeter').textContent=(ready?'READY FOR OFFLINE':'NOT FULLY READY')+
  ' · ENGINE '+(shell.ready?'OK':'MISSING')+' · MUSIC '+saved+'/'+planned.length+' · STATION IDs '+stations.saved+'/'+stations.total;
 find('geOfflineProgress').max=Math.max(1,planned.length);find('geOfflineProgress').value=saved;
 if(!quiet)say(ready?
  'Engine and planned recordings are saved. Test by closing the app, enabling Airplane Mode, then opening the Home Screen icon and playing music.':
  'Not ready: '+(installed?'':'Install the Home Screen app. ')+
  (shell.ready?'':'Engine: '+result.missing.slice(0,3).join(', ')+'. ')+
  (saved===planned.length&&planned.length?'':'Missing saved recordings. ')+
  'Your existing files are preserved.');
 return result;
}
async function publishedStations(){
 try{
  const url=new URL('./manifest.json',location.href).href;
  let response=await caches.match(url,{ignoreSearch:true});
  if(!response?.ok&&online())response=await fetch(url,{cache:'no-store'});
  if(!response?.ok)return [];
  const data=await response.json();
  return (Array.isArray(data.files)?data.files:[]).filter(p=>
    typeof p==='string'&&/^ge-music\/clips\/GE Station Identification - \d+\.(m4a|mp3|wav|ogg)$/i.test(p));
 }catch(_){return []}
}
async function stationStatus(){
 const clips=await publishedStations();let saved=0;
 for(const path of clips)if(await manager.anySaved(manager.fileURL(path)))saved++;
 return {saved,total:clips.length};
}
async function saveStations(){
 const list=await publishedStations(),cache=await caches.open('ge-radio-media-v4');
 let saved=0,failed=0;
 for(const path of list){
  if(stopping)break;
  const url=manager.fileURL(path);
  if(await manager.anySaved(url)){saved++;continue}
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
   let response;
   try{response=await fetch(url,{cache:'no-store',signal:controller.signal})}
   finally{clearTimeout(timer)}
   if(!response.ok||response.status!==200||/text\/html|application\/json/i.test(response.headers.get('content-type')||''))throw Error('Invalid station clip');
   const blob=await response.blob();
   if(blob.size<=128)throw Error('Empty station clip');
   const headers=new Headers(response.headers);headers.set('Content-Length',String(blob.size));
   await cache.put(url,new Response(blob,{status:200,headers}));
   if(!(await manager.anySaved(url)))throw Error('Station clip not stored');
   saved++;
  }catch(_){failed++}
 }
 try{await bridge().rescan?.()}catch(_){}
 return {saved,failed,total:list.length};
}
async function backgrounds(){
 const manifestURL=new URL('../ge-images/img/manifest.json',location.href).href;
 let names=[];
 try{
  const r=await fetch(manifestURL,{cache:'no-store'});
  if(!r.ok)throw Error('Background manifest unavailable');
  const data=await r.json();
  if(Array.isArray(data))names=data.filter(name=>typeof name==='string'&&/^[\w .-]+\.(gif|png|jpe?g|webp)$/i.test(name));
 }catch(error){say('Background manifest unavailable; saved player is unchanged.');return {saved:0,failed:1}}
 const cache=await caches.open(BG_CACHE);
 let saved=0,failed=0;
 for(const name of names){
  if(stopping)break;
  const url=new URL('../ge-images/img/'+encodeURIComponent(name),location.href).href;
  const old=await cache.match(url);
  if(old?.ok){saved++;continue}
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
   let response;
   try{response=await fetch(url,{cache:'no-store',signal:controller.signal})}
   finally{clearTimeout(timer)}
   if(!response.ok||!/image\//i.test(response.headers.get('content-type')||''))throw Error('Invalid background');
   await cache.put(url,response.clone());
   saved++;
  }catch(_){failed++}
  if(saved%5===0)say('Saving Radio backgrounds: '+saved+'/'+names.length+'. Keep the app open.');
 }
 return {saved,failed,total:names.length};
}
function setBusy(value){
 busy=value;
 for(const btn of [prepare,reload,repair,install,oldVerify])if(btn)btn.disabled=value;
}
async function job(fn){
 if(busy)return;
 setBusy(true);stopping=false;
 try{await fn()}catch(error){say('Offline setup: '+String(error?.message||error))}
 finally{setBusy(false);updateInstallLine()}
}
async function prepareAll(){
 await job(async()=>{
  if(!online()){say('Connect online first to prepare a new offline package.');return}
  if(!requireInstalled()||!permission())return;
  say('Verifying saved startup engine…');
  const reg=await worker();
  try{await reg.update()}catch(_){}
  const shell=await shellStatus();
  if(!shell.ready){say('Engine incomplete: '+shell.missing.slice(0,5).join(', ')+'. Reopen Radio online to activate the new startup engine.');return}
  await manager.download('all');
  if(stopping)return;
  await saveStations();
  if(stopping)return;
  await manager.saveArt();
  if(stopping)return;
  const bg=await backgrounds();
  const result=await readiness({quiet:true});
  if(result.ready)say('READY FOR OFFLINE. Startup and planned songs verified. '+bg.saved+' backgrounds saved. Test a restart in Airplane Mode.');
  else say('Setup incomplete: '+result.saved+'/'+result.total+' songs stored. CHECK & REPAIR will retry missing files.');
 });
}
async function repairAll(){
 await job(async()=>{
  const result=await readiness({quiet:true});
  if(result.ready){say('Offline startup and all planned songs are verified.');return}
  if(!online()){say('Offline check: '+result.saved+'/'+result.total+' songs, engine '+(result.engine?'ready':'missing')+'. Reconnect to repair.');return}
  if(!requireInstalled()||!permission())return;
  const reg=await worker();await reg.update().catch(()=>{});
  await manager.download('all');
  await saveStations();
  const after=await readiness({quiet:true});
  say(after.ready?'REPAIR COMPLETE. Ready for Airplane Mode testing.':
   'Repair incomplete: '+after.saved+'/'+after.total+' songs; engine '+(after.engine?'OK':'missing')+'.');
 });
}
async function update(){
 await job(async()=>{
  if(!online()){location.assign('./index.html?ge_home=1');return}
  say('Checking Grand Element Radio for new updates…');
  const reg=await worker();
  await reg.update().catch(()=>{});
  const wanted=plan();
  if(wanted.length&&hasPermission()&&requireInstalled()){
   // Existing files are skipped; newly published songs are saved without deleting anything.
   await manager.download('all');
   await saveStations();
  }
  if(!hasPermission()&&wanted.length){
   say('App updates checked. Existing songs are safe. CODE is needed only to download new tracks.');
  }
  location.reload();
 });
}
function installGuide(){
 say(isIOS()?
  'iPhone: open Radio in Safari, tap Share, choose Add to Home Screen, then Add. Launch that icon while ONLINE, open OFFLINE, and press PREPARE. Downloads from Safari do not automatically move into the installed app.':
  'Use the browser menu to Install App or Add to Home Screen. Open that app online and choose PREPARE FOR OFFLINE.');
}
surface.addEventListener('click',event=>{
 const act=event.target.closest('[data-offline]')?.dataset.offline;
 if(act==='prepare')void prepareAll();
 if(act==='repair')void repairAll();
 if(act==='reload')void update();
 if(act==='install')installGuide();
 if(act==='verify')void readiness();
 if(act==='stop')stopping=true;

});
document.getElementById('offlineLaunchBtn')?.addEventListener('click',updateInstallLine);
window.GEOfflineSetup={onSaved,readiness,shellStatus,isInstalled,prepareAll};
})();
