/* One public application update controller. Production revision is generated
   by the existing GitHub Pages build, never by a pending main-branch commit. */
(()=>{
'use strict';
const LAST='GE_WEBSITE_LAST_RELEASE_V1',COMPLETE='GE_WEBSITE_UPDATE_COMPLETE_V1';
let current='',latest='',busy=false,started=false,pendingCheck=null;
const listeners=new Set();
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value)?value.toLowerCase():'';
function notify(){const state={current,latest,busy,available:!!(current&&latest&&current!==latest&&!busy)};
 for(const fn of listeners){try{fn(state)}catch(_){}}
 return state;
}
function get(store,key){try{return window[store].getItem(key)||''}catch(_){return ''}}
function put(store,key,value){try{window[store].setItem(key,value)}catch(_){}}
async function remote(){
 if(navigator.onLine===false)throw Error('Connect online to check for updates.');
 const url=new URL('./release-version.json',location.href);url.searchParams.set('ge_release_check',String(Date.now()));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch(url.href,{cache:'no-store',headers:{'X-GE-Reload':'1'},signal:controller.signal});
  if(!r.ok)throw Error('Production version check unavailable.');
  const doc=await r.json(),id=revision(doc?.revision);
  if(!id)throw Error('Production version could not be verified.');
  return id;
 }finally{clearTimeout(timer)}
}
async function check(){
 if(busy)return notify();
 if(pendingCheck)return pendingCheck;
 pendingCheck=(async()=>{
  try{latest=await remote();if(!current){current=latest;put('localStorage',LAST,current)}}
  catch(_){latest='';if(!current)current=revision(get('localStorage',LAST))}
  return notify();
 })().finally(()=>{pendingCheck=null});
 return pendingCheck;
}
function subscribe(fn){listeners.add(fn);notify();return ()=>listeners.delete(fn)}
function start(){
 if(started)return;started=true;
 void check();setInterval(check,120000);
 window.addEventListener('online',check);
 window.addEventListener('offline',()=>{latest='';notify()});
 window.addEventListener('focus',check);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check()});
}
function ask(worker,type,ms){
 return new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('Update verification timed out.'))},ms);
  channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};
  try{worker.postMessage({type},[channel.port2])}
  catch(error){clearTimeout(timer);channel.port1.close();reject(error)}
 });
}
async function settle(reg){
 const candidate=reg.installing||reg.waiting;
 if(candidate&&candidate.state!=='activated'&&candidate.state!=='redundant'){
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{candidate.removeEventListener('statechange',changed);reject(Error('New application files are still preparing.'))},65000);
   function changed(){if(!['activated','redundant'].includes(candidate.state))return;
    clearTimeout(timer);candidate.removeEventListener('statechange',changed);
    if(candidate.state==='redundant')reject(Error('New application package could not be installed.'));else resolve()}
   candidate.addEventListener('statechange',changed);changed();
  });
 }
}
async function update(show=()=>{}){
 if(busy)return;
 if(window.GEOfflineDownloads?.isBusy?.()){show('Finish or stop your current offline download first.');return}
 if(navigator.onLine===false){show('Connect online to check for updates. Saved music and settings kept.');return}
 busy=true;notify();show('CHECKING VERSION…');
 try{
  if(pendingCheck)await pendingCheck;
  const target=await remote();latest=target;
  if(!current)current=target;
  if(!navigator.serviceWorker)throw Error('This browser cannot verify the saved application.');
  const registration=await navigator.serviceWorker.getRegistration('./');
  if(!registration)throw Error('Website setup is not ready. Reopen Radio online.');
  show('UPDATING APPLICATION FILES…');
  await registration.update();await settle(registration);
  const active=(await navigator.serviceWorker.getRegistration('./'))?.active;
  if(!active)throw Error('Offline startup is not active.');
  const result=await ask(active,'GE_RADIO_SHELL_REPAIR',65000);
  if(result?.type!=='GE_RADIO_SHELL_REPAIR_RESULT'||result.ready!==true||result.error)
   throw Error(result?.error||result?.missing?.[0]||'Application files could not be verified.');
  const verified=await ask(active,'GE_RADIO_SHELL_STATUS',15000);
  if(verified?.ready!==true)throw Error('Updated startup package is incomplete.');
  if(await remote()!==target)throw Error('Another release became available. Press UPDATE again.');
  put('sessionStorage',COMPLETE,target);
  show(current===target?'UP TO DATE · Refreshing…':'UPDATE COMPLETE · Refreshing…');
  const url=new URL(location.href);url.searchParams.set('fresh',String(Date.now()));location.replace(url.href);
 }catch(error){show(String(error?.message||error)+' Saved music, access and settings kept.')}
 finally{busy=false;notify()}
}
function completed(){
 const expected=revision(get('sessionStorage',COMPLETE));
 if(!expected||expected!==current||expected!==latest)return false;
 try{sessionStorage.removeItem(COMPLETE)}catch(_){}
 return true;
}
window.GEWebsiteUpdate={check,start,subscribe,update,completed};
})();
