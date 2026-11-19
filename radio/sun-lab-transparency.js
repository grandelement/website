/* GE Radio: three user-adjustable visual transparency settings.
   No EQ or audio pipeline changes. Keep buttons' icons and labels readable. */
(()=>{
 'use strict';
 const KEY='GE_RADIO_TRANSPARENCY_V1';
 const DEFAULTS={sun:0,music:50,other:50};
 const ids={sun:'geAlphaSun',music:'geAlphaMusic',other:'geAlphaOther'};
 const vars={sun:'--ge-sun-art-opacity',music:'--ge-music-button-alpha',other:'--ge-other-button-alpha'};
 const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
 let saved={};
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&typeof raw==='object')saved=raw;}catch(_){}
 const values={...DEFAULTS};
 for(const key of Object.keys(DEFAULTS))if(Number.isFinite(Number(saved[key])))values[key]=clamp(saved[key]);
 const root=document.documentElement;
 function apply(){
  root.style.setProperty(vars.sun,String((100-values.sun)/100));
  root.style.setProperty(vars.music,String((100-values.music)/100));
  root.style.setProperty(vars.other,String((100-values.other)/100));
 }
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(values));}catch(_){}}
 function bind(){
  for(const key of Object.keys(ids)){
   const input=document.getElementById(ids[key]),output=document.getElementById(ids[key]+'Val');
   if(!input)continue;
   input.value=String(values[key]);
   if(output)output.textContent=values[key]+'%';
   input.addEventListener('input',()=>{
    values[key]=clamp(input.value);
    if(output)output.textContent=values[key]+'%';
    apply();persist();
   });
  }
  const toggle=document.getElementById('geSunLabTransparencyToggle');
  const fields=document.getElementById('geSunLabTransparencyFields');
  if(toggle&&fields){
   toggle.addEventListener('click',()=>{
    fields.hidden=!fields.hidden;
    toggle.setAttribute('aria-expanded',String(!fields.hidden));
    toggle.textContent=fields.hidden?'TRANSPARENCY ▾':'TRANSPARENCY ▴';
   });
  }
 }
 apply();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
 else bind();
 window.GERadioTransparency={get:()=>({...values})};
})();
