/* Sun Lab compact controls. Isolated UI adapter; no audio graph modifications. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='GE_SUN_LAB_SPECTRUM_POSITION_V1';
const config=[
 ['Position',-30,30,0,'Spectrum starting radius relative to the Sun','position'],
 ['Reach',-440,220,55,'How far the spectrum extends','slDistance'],
 ['Pulse Depth',0,100,82,'Makes beats alternate between dark and bright','slPulseDepth'],
 ['Release',0,100,72,'Higher makes each beat fall back toward darkness faster','slPulseRelease'],
 ['Detail',0,100,65,'Ray thickness and separation','detail']
];
function setNative(id,value){const el=$(id);if(!el)return;el.value=String(Math.max(Number(el.min),Math.min(Number(el.max),value)));el.dispatchEvent(new Event('input',{bubbles:true}));}
function init(){
 const grid=$('sunLabGrid'),panel=$('sunLabPanel');if(!grid||!panel)return;
 const box=document.createElement('section');box.id='geSunCompact';box.setAttribute('aria-label','Sun Lab movement controls');
 box.innerHTML='<h4>Movement controls</h4><p>Attach the spectrum to the Sun, then shape its response to the music.</p>';
 const controls=new Map();
 for(const [name,min,max,def,help,key] of config){
  const row=document.createElement('label');row.className='ge-sun-compact-row';
  const head=document.createElement('span');head.textContent=name;
  const value=document.createElement('output');value.textContent=String(def);
  const slider=document.createElement('input');slider.type='range';slider.min=min;slider.max=max;slider.step='1';slider.value=def;slider.setAttribute('aria-label',name);slider.title=help;
  row.append(head,value,slider);box.append(row);controls.set(key,{slider,value});
 }
 const actions=document.createElement('div');actions.className='ge-sun-compact-actions';
 const starter=document.createElement('button');starter.type='button';starter.textContent='FIND MOVEMENT';starter.title='Load a movement-focused starting point, then adjust to your music';
 const advanced=document.createElement('button');advanced.type='button';advanced.textContent='ADVANCED SETTINGS ▾';advanced.setAttribute('aria-expanded','false');
 actions.append(starter,advanced);box.append(actions);
 const status=document.createElement('p');status.id='geSunCompactStatus';status.setAttribute('role','status');status.textContent='Movement requires live audio spectrum data.';box.append(status);
 grid.before(box);
 // Phone: start with the five readable controls. Desktop keeps all original
 // advanced sliders visible, so precision editing remains practical.
 const onPhone=window.matchMedia?.('(max-width:720px)').matches??false;
 grid.hidden=onPhone;
 if(!onPhone){advanced.setAttribute('aria-expanded','true');advanced.textContent='ADVANCED SETTINGS ▴';}
 // Preserve original DOM and original effect profiles. Never reparent rows.
 advanced.addEventListener('click',()=>{
   if(panel.classList.contains('ge-sunlab-public')){
     status.textContent='Advanced EQ settings require an authorized access code.';
     return;
   }
   const expanded=advanced.getAttribute('aria-expanded')!=='true';
   advanced.setAttribute('aria-expanded',String(expanded));
   advanced.textContent=expanded?'ADVANCED SETTINGS ▴':'ADVANCED SETTINGS ▾';
   grid.hidden=!expanded;
 });
 const aura=$('sunEQAura')||document.querySelector('.sun-eq-aura');
 let position=0;try{position=Number(localStorage.getItem(KEY)||0)||0;}catch(_){}
 function applyPosition(v){position=v; if(aura)aura.dataset.gePosition=String(v);try{localStorage.setItem(KEY,String(v));}catch(_){}}
 function update(key,v){const c=controls.get(key);if(!c)return;c.slider.value=String(v);c.value.textContent=String(v);if(key==='position')applyPosition(v);
 else if(key==='detail'){setNative('slThickness',Math.round(12+v*1.65));setNative('slContrast',Math.round(75+v*1.5));}
 else if(key==='slCascadeSpeed'){setNative(key,v);setNative('slSpectrumSpeed',v);setNative('slSmoothing',Math.round(75-v*.68));}
 else setNative(key,v);
 }
 for(const [key,c] of controls)c.slider.addEventListener('input',()=>update(key,Number(c.slider.value)));
 update('position',position);
 // Read existing per-effect values; don't overwrite saved presets at load.
 for(const key of ['slDistance','slPulseDepth','slPulseRelease']){const el=$(key);if(el){const c=controls.get(key);c.slider.value=el.value;c.value.textContent=el.value;el.addEventListener('input',()=>{c.slider.value=el.value;c.value.textContent=el.value;});}}
 starter.addEventListener('click',()=>{
   update('position',0);update('slDistance',75);update('slPulseDepth',92);
   update('slPulseRelease',83);update('detail',62);
   if(!panel.classList.contains('ge-sunlab-public')){
     setNative('slPulseSensitivity',82);setNative('slPulseAttack',92);
     setNative('slPulseNoiseFloor',13);setNative('slGlow',0);
     setNative('slMist',10);setNative('slBrightness',145);
   }
   status.textContent='Beat pulse ready. Play music to see the light flash with the real frequencies.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
