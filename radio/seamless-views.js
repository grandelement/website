/* GE Seamless Views: one living Radio audio element while Website/Radio views swap.
   Same-origin iframe portal, with in-page navigation instead of hard page reloads.
   No duplicate station player, no public mixer changes, no forced audio pause.
   The direct /radio and homepage routes remain independently usable. */
(function(){
'use strict';
const params=new URLSearchParams(location.search);
const host=location.origin;
const radioPage=!!document.getElementById('homeLink')&&!!document.getElementById('player');
const websitePage=!!document.getElementById('gePlayer')&&!!document.getElementById('moon');
if(!radioPage&&!websitePage)return;
const embedded=window.parent!==window&&params.has('ge_portal');
const audio=radioPage?document.getElementById('player'):document.getElementById('gePlayer');
const play=websitePage?document.getElementById('play'):document.getElementById('playBtn');
const stop=websitePage?document.getElementById('geHomeStop'):null;
const transportState=()=>({playing:!!audio&&!audio.paused&&!audio.ended,radio:true});
let frame=null,ready=false,visible=false,latest={playing:false,radio:true};
const send=(target,type,value)=>{try{target.postMessage({ge_seamless:1,type,value},host)}catch(_){}};
const parentSend=(type,value)=>send(window.parent,type,value);
function radioStart(){
  if(!radioPage)return false;
  if(!audio.paused)return true;
  // A native click within the original user gesture retains Safari's media
  // activation when both frames are same-origin and already initialized.
  const liveButton=document.getElementById('liveBtn');
  // A private Gate playlist must stay private; resuming it must not retune
  // the person to LIVE or destroy their programmed sequence.
  if(liveButton?.getAttribute('aria-pressed')==='false')
    document.getElementById('playBtn')?.click();
  else liveButton?.click();
  return true;
}
function radioStop(){
  if(!radioPage)return false;
  if(!audio.paused)document.getElementById('playBtn')?.click();
  return true;
}
function updateHome(state){
  latest={...latest,...state};
  if(!websitePage)return;
  const p=latest.playing;
  if(play){
    play.textContent=p?'STOP':'PLAY';
    play.setAttribute('aria-label',p?'Stop Grand Element Radio':'Play Grand Element Radio');
    play.title=p?'Stop Grand Element Radio':'Play Grand Element Radio';
    play.setAttribute('aria-pressed',p?'true':'false');
  }
  if(stop)stop.hidden=true;
  try{window.GE_MOON_RADIO_METER?.set?.(p?.44:0,!!p)}catch(_){}
  const label=document.getElementById('geHomeRadioStatus');
  if(label)label.textContent=p?'GRAND ELEMENT RADIO · LIVE':'TAP PLAY · GRAND ELEMENT RADIO';
}
function placeFrame(targetURL,id,title){
  const f=document.createElement('iframe');
  f.id=id;f.title=title;f.src=targetURL;f.setAttribute('allow','autoplay');
  f.setAttribute('aria-hidden','true');f.tabIndex=-1;
  f.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;border:0;margin:0;padding:0;background:#010308;z-index:2147481000;opacity:0;pointer-events:none;transform:translate3d(0,0,0);';
  document.body.appendChild(f);
  f.addEventListener('load',()=>{ready=true;if(radioPage&&visible)send(f.contentWindow,'audio',transportState());});
  return f;
}
function openFrame(){
  if(embedded||!frame)return false;
  visible=true;
  frame.style.opacity='1';frame.style.pointerEvents='auto';
  frame.setAttribute('aria-hidden','false');frame.removeAttribute('tabindex');
  document.documentElement.classList.add('ge-portal-open');
  return true;
}
function closeFrame(){
  if(embedded||!frame)return false;
  visible=false;
  frame.style.opacity='0';frame.style.pointerEvents='none';
  frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
  document.documentElement.classList.remove('ge-portal-open');
  if(websitePage)updateHome(readRadio());
  return true;
}
function readRadio(){
  if(radioPage)return transportState();
  try{
    const a=frame?.contentWindow?.document?.getElementById('player');
    if(a)return {playing:!a.paused&&!a.ended,radio:true};
  }catch(_){}
  return latest;
}
function command(action){
  if(radioPage){
    if(action==='play')return radioStart();
    if(action==='stop')return radioStop();
    return false;
  }
  // Do not fall back to the separate homepage audio; that would create
  // a second audio source and an audible restart at the next view swap.
  const remote=frame?.contentWindow?.GESeamlessAudio;
  if(remote){
    const result=action==='play'?remote.start():remote.stop();
    updateHome(readRadio());return result;
  }
  const status=document.getElementById('geHomeRadioStatus');
  if(status)status.textContent='RADIO LOADING · TAP PLAY WHEN READY';
  return false;
}
function goRadio(){
  if(websitePage&&embedded){
    parentSend('view','radio');return true;
  }
  if(websitePage)return openFrame();
  if(radioPage&&!embedded)return closeFrame();
  return false;
}
function goWebsite(){
  if(radioPage&&embedded){
    parentSend('view','website');return true;
  }
  if(radioPage)return openFrame();
  if(websitePage&&!embedded)return closeFrame();
  return false;
}
function onMessage(event){
  if(event.origin!==host||event.data?.ge_seamless!==1)return;
  if(embedded){
    if(websitePage&&event.data.type==='audio')updateHome(event.data.value||{});
    return;
  }
  if(!frame||event.source!==frame.contentWindow)return;
  const {type,value}=event.data;
  if(type==='view'){
    if((websitePage&&value==='radio')||(radioPage&&value==='website'))openFrame();
    else closeFrame();
  }else if(type==='command'&&radioPage){
    command(value);
    send(frame.contentWindow,'audio',transportState());
  }else if(type==='audio'&&websitePage){
    updateHome(value||{});
  }else if(type==='ready'){
    if(radioPage)send(frame.contentWindow,'audio',transportState());
    else updateHome(readRadio());
  }
}
window.addEventListener('message',onMessage);
if(radioPage){
  window.GESeamlessAudio={start:radioStart,stop:radioStop,status:transportState};
  const home=document.getElementById('homeLink');
  if(home)home.addEventListener('click',e=>{
    if(goWebsite()){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  const broadcast=()=>{
    if(embedded)parentSend('audio',transportState());
    else if(frame?.contentWindow)send(frame.contentWindow,'audio',transportState());
  };
  ['playing','pause','ended','error'].forEach(type=>audio?.addEventListener(type,broadcast,{passive:true}));
  if(embedded){
    document.documentElement.classList.add('ge-seamless-embedded');
    parentSend('ready','radio');
  }else{
    frame=placeFrame(new URL('../?ge_portal=radio',location.href).href,
      'geWebsitePortal','Grand Element Website');
  }
}else if(websitePage){
  // Intercept transport before the old homepage handler. The old audio never
  // receives PLAY, so switching views cannot restart its stream.
  if(play)play.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(embedded)parentSend('command',latest.playing?'stop':'play');
    else command(readRadio().playing?'stop':'play');
  },true);
  if(stop)stop.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(embedded)parentSend('command','stop');else command('stop');
  },true);
  if(window.GE_HOME_RADIO){
    window.GE_HOME_RADIO.play=()=>{
      if(embedded)parentSend('command','play');else command('play');
    };
    window.GE_HOME_RADIO.stop=()=>{
      if(embedded)parentSend('command','stop');else command('stop');
    };
    window.GE_HOME_RADIO.playPause=()=>{
      if(embedded)parentSend('command',latest.playing?'stop':'play');
      else command(readRadio().playing?'stop':'play');
    };
    window.GE_HOME_RADIO.playing=()=>embedded?latest.playing:readRadio().playing;
  }
  if(window.GE_MUSIC_CONTROLLER){
    window.GE_MUSIC_CONTROLLER.playPause=()=>{
      if(embedded)parentSend('command',latest.playing?'stop':'play');
      else command(readRadio().playing?'stop':'play');
    };
    window.GE_MUSIC_CONTROLLER.ensurePlaying=async()=>{
      if(embedded){parentSend('command','play');return true;}
      return command('play');
    };
  }
  if(embedded){
    document.documentElement.classList.add('ge-seamless-embedded');
    parentSend('ready','website');
  }else{
    frame=placeFrame(new URL('./radio/?ge_portal=website',location.href).href,
      'geRadioPortal','Grand Element Radio');
    frame.addEventListener('load',()=>updateHome(readRadio()));
  }
  updateHome(latest);
}
window.GESeamless={radio:goRadio,website:goWebsite,playing:()=>readRadio().playing};
})();
