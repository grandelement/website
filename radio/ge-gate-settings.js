/* Shared, read-only PUBLIC Gate timing. Back Room publishes config/site-live.json.
   One configuration for Radio and the independent 33:33 music preview.
   BLITZ broadcasts and server files are never altered. */
(function(){
'use strict';
const defaults=Object.freeze({
 sequenceSpeed:1.5,blurLeadSeconds:6,waveLeadSeconds:10,
 entranceSeconds:70,graceSeconds:11,fadeSeconds:33,reverbMax:1
});
const bounds={
 sequenceSpeed:[.5,3],blurLeadSeconds:[0,30],waveLeadSeconds:[0,45],
 entranceSeconds:[8,180],graceSeconds:[0,90],fadeSeconds:[5,120],
 reverbMax:[0,1.5]
};
const clamp=(n,key)=>{
 const [min,max]=bounds[key];const v=Number(n);
 return Number.isFinite(v)?Math.max(min,Math.min(max,v)):defaults[key];
};
let values={...defaults},loaded=false;
const ready=fetch('../config/site-live.json',{cache:'no-store'})
 .then(async response=>{
   if(!response.ok)throw new Error('Gate settings fetch '+response.status);
   const published=(await response.json()).gateTiming||{};
   values=Object.fromEntries(Object.keys(defaults).map(key=>
     [key,clamp(published[key],key)]));
   loaded=true;
   window.dispatchEvent(new Event('ge-gate-settings-ready'));
   return {...values};
 }).catch(()=>({...values}));
window.GEGateSettings={defaults,get:()=>({...values}),ready,
 loaded:()=>loaded};
})();
