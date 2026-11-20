/* Sun Lab compact controls. Isolated UI adapter; no audio graph modifications. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='GE_SUN_LAB_SPECTRUM_POSITION_V1';
const config=[
 ['Position',-30,30,0,'Spectrum starting radius relative to the Sun','position'],
 ['Reach',-440,220,55,'How far the spectrum extends','slDistance'],
 ['Movement',0,380,190,'Strength of music-driven movement','slDynamics'],
 ['Speed',0,100,65,'Response and waterfall travel speed','slCascadeSpeed'],
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
 // Preserve the original Sun Lab control DOM and mode selectors.
 // Reparenting these rows breaks the existing EQ mode UI and visualizer wiring.
 advanced.addEventListener('click',()=>{
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
 for(const key of ['slDistance','slDynamics','slCascadeSpeed']){const el=$(key);if(el){const c=controls.get(key);c.slider.value=el.value;c.value.textContent=el.value;el.addEventListener('input',()=>{c.slider.value=el.value;c.value.textContent=el.value;});}}
 starter.addEventListener('click',()=>{update('position',0);update('slDistance',75);update('slDynamics',230);update('slCascadeSpeed',72);update('detail',70);setNative('slGlow',0);setNative('slMist',10);setNative('slBrightness',145);status.textContent='Movement starting point loaded. Play music and confirm the live spectrum meter changes.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
