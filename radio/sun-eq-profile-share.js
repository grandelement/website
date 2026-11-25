/* GE Sun Lab settings portability.
   A one-tap copy/share link carries the user's OWN EQ settings between
   devices without touching accounts, Gate, media caches or audio tracks. */
(()=>{
'use strict';
const PROFILE_KEY='GE_SUN_LAB_MODE_PROFILES_V3';
const CURRENT_KEY='GE_SUN_LAB_V7';
const SELECTED_KEY='GE_SUN_LAB_SELECTED_MODE_V1';
const BALANCED_KEY='GE_SUN_EQ_BRIGHTNESS_BALANCED_20261119_V1';
const PREFIX='#ge-sun-preset=';
const MODES=['plasma','spectrum','glow','waterfall','pulse','ripples','orbit','aurora'];
const WAVE={plasma:'plasma',spectrum:'spectrum',glow:'glow',waterfall:'mirrorflip',
 pulse:'plasma',ripples:'mirrorflip',orbit:'spectrum',aurora:'glow'};
const FIELDS=[
 'distance','thickness','contrast','dynamics','glow','mist','blueDepth',
 'outerFade','tipWhite','brightness','hue','hueMix','altHue','bass','mid',
 'treble','compression','smoothing','radialOn','cascadeOn','cascadeSpeed',
 'glowOnly','spectrumSpeed','spectrumGain','bandColorMix','lowHue',
 'midHue','highHue','innerGlowReach','innerGlowStrength','innerGlowHue',
 'outerGlowReach','outerGlowStrength','outerGlowHue','pulseDepth',
 'pulseSensitivity','pulseAttack','pulseRelease','pulseNoiseFloor'];
const BOOLEAN=new Set(['radialOn','cascadeOn','glowOnly']);
const get=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null}};
const allowed=(v,key)=>BOOLEAN.has(key)?typeof v==='boolean':
  typeof v==='number'&&Number.isFinite(v)&&v>=-1000&&v<=1000;
function pack(v){
 if(!v||typeof v!=='object')return [];
 const arr=FIELDS.map(key=>allowed(v[key],key)?v[key]:null);
 while(arr.length&&arr[arr.length-1]===null)arr.pop();
 return arr;
}
function unpack(list,mode){
 if(!Array.isArray(list)||list.length>FIELDS.length)return null;
 const values={waveType:WAVE[mode]};
 for(let i=0;i<list.length;i++){
   const value=list[i],key=FIELDS[i];
   if(allowed(value,key))values[key]=value;
 }
 return values;
}
function payload(){
 const selected=localStorage.getItem(SELECTED_KEY);
 const mode=MODES.includes(selected)?selected:'waterfall';
 const profiles=get(PROFILE_KEY)||{};
 // Current unsaved panel edits take precedence over an older mode copy.
 profiles[mode]=get(CURRENT_KEY)||profiles[mode]||{};
 const packed={};
 for(const name of MODES){
   if(profiles[name]&&typeof profiles[name]==='object')packed[name]=pack(profiles[name]);
 }
 return {v:1,m:mode,p:packed};
}
function exportURL(){
 const data=JSON.stringify(payload());
 const token=btoa(data).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const url=new URL(location.href);
 url.hash=PREFIX.slice(1)+token;
 return url.href;
}
function readPayload(){
 if(!location.hash.startsWith(PREFIX))return null;
 const token=location.hash.slice(PREFIX.length);
 if(!token||token.length>18000)return null;
 try{
   const ascii=atob(token.replace(/-/g,'+').replace(/_/g,'/'));
   const data=JSON.parse(ascii);
   if(data?.v!==1||!MODES.includes(data.m)||!data.p||
      typeof data.p!=='object'||Array.isArray(data.p))return null;
   const profiles={};
   for(const mode of MODES){
     if(!Object.hasOwn(data.p,mode))continue;
     const values=unpack(data.p[mode],mode);
     if(values)profiles[mode]=values;
   }
   if(!profiles[data.m])return null;
   return {selected:data.m,profiles};
 }catch(_){return null;}
}
function importURL(){
 const imported=readPayload();
 if(!imported)return false;
 if(!confirm('Apply these Grand Element Sun EQ settings to this device?'))return false;
 try{
   localStorage.setItem(PROFILE_KEY,JSON.stringify(imported.profiles));
   localStorage.setItem(CURRENT_KEY,JSON.stringify(imported.profiles[imported.selected]));
   localStorage.setItem(SELECTED_KEY,imported.selected);
   // A prior release capped bright settings; do not change the newly imported
   // user's values during the next startup.
   localStorage.setItem(BALANCED_KEY,'1');
 }catch(_){alert('Could not save EQ settings on this device.');return false;}
 const clean=location.pathname+location.search;
 history.replaceState(history.state,'',clean);
 location.reload();
 return true;
}
function setup(){
 const button=document.getElementById('sunLabCopyPhoneLink');
 const status=document.getElementById('sunLabShareStatus');
 button?.addEventListener('click',async()=>{
   const link=exportURL();
   try{
     if(navigator.share){
       await navigator.share({title:'Grand Element Sun EQ settings',url:link});
       if(status)status.textContent='EQ settings shared. Open the link on your other device.';
     }else if(navigator.clipboard?.writeText){
       await navigator.clipboard.writeText(link);
       if(status)status.textContent='Settings link copied. Send it to your iPhone and open it.';
     }else{
       prompt('Copy this EQ settings link to your phone:',link);
       if(status)status.textContent='Use the link on your other device to import your settings.';
     }
   }catch(error){
     if(error?.name!=='AbortError'){
       prompt('Copy this EQ settings link:',link);
       if(status)status.textContent='Paste the link into Safari on your iPhone.';
     }
   }
 });
 if(location.hash.startsWith(PREFIX)){
   const applied=importURL();
   if(!applied)history.replaceState(history.state,'',location.pathname+location.search);
 }
}
window.GESunEQShare={exportURL,readPayload,importURL};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
else setup();
})();