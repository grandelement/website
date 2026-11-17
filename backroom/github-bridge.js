/* One Back Room entrance, one unlock, one SAVE.
 * Bridge owns only same-origin messages to the verified GitHub music editor.
 * Private fan/access/DJ services retain their existing authentication. */
(()=>{
'use strict';
const frame=document.getElementById('brDirectPublisherFrame');
if(!frame)return;
const output=document.getElementById('brDirectPublisherStatus');
const topStatus=document.getElementById('brCentralSaveStatus');
const saveButton=document.getElementById('brTopSave');
const waiting=new Map();
let ready=false,loaded=false,pendingPassword='',number=0,lastConfig=null;
const post=(type,details={})=>{
 if(!ready||!frame.contentWindow)return false;
 frame.contentWindow.postMessage({type,...details},location.origin);
 return true;
};
function report(message,kind='warn'){
 const text=String(message);
 if(output)output.textContent=text;
 if(topStatus&&(/NOT SAVED|NOT LOADED|SAVED AND VERIFIED|GITHUB SAVE VERIFIED/i.test(text))){
  topStatus.hidden=false;
  topStatus.textContent=text;
  topStatus.dataset.kind=kind;
 }
}
function unlock(password){
 pendingPassword=String(password||'');
 if(ready&&pendingPassword){
  post('GE_BACKROOM_UNLOCK',{passcode:pendingPassword});
  pendingPassword='';
 }
}
function publishConfig(config){
 if(!config||typeof config!=='object'||!Array.isArray(config.music?.radioMasterSongPaths))return;
 lastConfig=config;
 document.dispatchEvent(new CustomEvent('ge-direct-config',{detail:config}));
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow||!event.data)return;
 const message=event.data;
 switch(message.type){
 case 'GE_DIRECT_READY':
  ready=true;if(pendingPassword)unlock(pendingPassword);break;
 case 'GE_DIRECT_HEIGHT':{
  const value=Number(message.height);
  if(Number.isFinite(value))frame.style.height=Math.max(450,Math.min(25000,value))+'px';
  break;
 }
 case 'GE_DIRECT_LOCKED':loaded=false;break;
 case 'GE_DIRECT_UNLOCKED':report('READING CURRENT GITHUB SETTINGS AUTOMATICALLY…');break;
 case 'GE_DIRECT_LOADED':
  loaded=true;
  publishConfig(message.config);
  report('GITHUB READY · '+Number(message.summary?.files||0)+' FILES · '+
   Number(message.summary?.radio||0)+' RADIO SONGS · ALL SETTINGS LOADED','success');
  break;
 case 'GE_DIRECT_COMMIT':
  publishConfig(message.config);
  report('GITHUB SAVE VERIFIED · '+String(message.commit||'').slice(0,12),'success');
  break;
 case 'GE_DIRECT_STATUS':{
  const value=String(message.message||'');
  if(/NOT SAVED|NOT LOADED|UNLOCK|CONNECTION|SAVED AND VERIFIED|SAVING|GITHUB/i.test(value))
   report(value,message.kind||'warn');
  break;
 }
 case 'GE_DIRECT_PUBLIC_RESULT':{
  const task=waiting.get(message.requestId);
  if(!task)return;
  waiting.delete(message.requestId);clearTimeout(task.timer);
  if(message.ok)task.resolve(message);
  else task.reject(Error(String(message.error||'GitHub could not verify the save.')));
  break;
 }
 }
});
frame.addEventListener('load',()=>{ready=true;if(pendingPassword)unlock(pendingPassword)});
if(saveButton)saveButton.addEventListener('click',event=>{
 const tab=document.querySelector('#backroomMain button[data-tab][aria-selected="true"]')?.dataset.tab;
 if(tab!=='radio'&&tab!=='website')return;
 event.preventDefault();event.stopImmediatePropagation();
 if(!loaded){
  report('NOT SAVED · GitHub is not connected. Use the one-time connection in the Back Room music panel.','error');
  return;
 }
 if(!confirm('SAVE PUBLIC MUSIC AND PLAYER SETTINGS TO GITHUB?\n\nThe live BLITZ DJ queue, private fans and access codes will not change.'))return;
 report('SAVING TO GITHUB…');
 post('GE_BACKROOM_SAVE',{confirmed:true});
},true);
function patch(changes,expected){
 if(!ready||!loaded)return Promise.reject(Error('GitHub is not connected yet. Finish the one-time connection in the music settings panel.'));
 const requestId='br-'+(++number);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{waiting.delete(requestId);reject(Error('GitHub did not verify the save. Your settings remain on screen.'))},45000);
  waiting.set(requestId,{timer,resolve,reject});
  post('GE_BACKROOM_PUBLIC_PATCH',{requestId,changes,expected});
 });
}
window.GE_DIRECT_BRIDGE={
 unlock,patch,
 get latestConfig(){return lastConfig},
 get connected(){return ready&&loaded}
};
})();