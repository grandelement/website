import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pulseSource=fs.readFileSync('radio/sun-pulse-engine.js','utf8');
const transferSource=fs.readFileSync('radio/sun-eq-profile-share.js','utf8');
const radio=fs.readFileSync('radio/index.html','utf8');
const ui=fs.readFileSync('radio/sun-lab-compact.js','utf8');
const fake={};
vm.runInNewContext(pulseSource,{window:fake,performance:{now:()=>0}});
const engine=fake.GESunPulseEngine;
assert.equal(typeof engine.process,'function');
const frames=v=>new Uint8Array(256).fill(Math.round(v*255));
let tick=0;
const run=(v,opts)=>engine.process(frames(v),opts,tick+=33)[14];
const steady=Array.from({length:50},()=>run(.46,{})).at(-1);
const burst=run(.70,{});
const falling=Array.from({length:8},()=>run(.46,{}));
assert(steady<70,'steady music should remain visibly dim, not saturated');
assert(burst>steady+110,'a real level change must cause a strong flash');
assert(falling.at(-1)<steady+15,'pulse must return to darkness after the beat');
engine.reset();
tick=0;
const silence=run(0,{});
assert.equal(silence,0,'silence must never create fake movement');
function releaseComparison(pulseRelease){
 engine.reset();tick=0;
 for(let i=0;i<50;i++)run(.46,{pulseRelease});
 run(.70,{pulseRelease});
 return run(.46,{pulseRelease});
}
assert(releaseComparison(100)<releaseComparison(0),'faster release visibly falls sooner');
assert.match(radio,/sunLab\.pulseDepth/);
assert.match(radio,/sunLab\.pulseAttack/);
assert.match(radio,/sunLab\.pulseRelease/);
assert.match(radio,/sun-pulse-engine\.js/);
assert.match(radio,/sun-eq-profile-share\.js/);
assert.match(ui,/Pulse Depth/);
assert.match(ui,/Release/);

function mockDevice(initial={},href='https://www.grandelement.com/radio/'){
 const stored=new Map(Object.entries(initial));
 let reloaded=false,cleaned=false;
 const url=new URL(href);
 const location={href:url.href,hash:url.hash,pathname:url.pathname,search:url.search,
  reload:()=>{reloaded=true}};
 const sandbox={
  window:{},URL,localStorage:{
   getItem:key=>stored.get(key)??null,
   setItem:(key,value)=>stored.set(key,String(value))
  },
  document:{readyState:'loading',addEventListener:()=>{},getElementById:()=>null},
  location,history:{state:null,replaceState:()=>{cleaned=true}},
  confirm:()=>true,alert:()=>{},btoa,atob,console
 };
 vm.runInNewContext(transferSource,sandbox);
 return {share:sandbox.window.GESunEQShare,stored,location,
  wasReloaded:()=>reloaded,wasCleaned:()=>cleaned};
}
const src=mockDevice({
 GE_SUN_LAB_SELECTED_MODE_V1:'waterfall',
 GE_SUN_LAB_V7:JSON.stringify({waveType:'mirrorflip',brightness:181,pulseDepth:99,pulseRelease:92,distance:-15}),
 GE_SUN_LAB_MODE_PROFILES_V3:JSON.stringify({
  spectrum:{waveType:'spectrum',brightness:205,pulseDepth:86,spectrumGain:125},
  waterfall:{waveType:'mirrorflip',brightness:181,pulseDepth:99,pulseRelease:92}
 })
});
const link=src.share.exportURL();
assert(link.startsWith('https://www.grandelement.com/radio/#ge-sun-preset='));
assert(link.length<10000,'one settings link must fit comfortably in a phone browser');
const dst=mockDevice({GE_VAULT_ACCESS:'UNCHANGED'},link);
assert.equal(dst.share.readPayload().selected,'waterfall');
assert.equal(dst.share.importURL(),true);
assert.equal(dst.wasReloaded(),true);
assert.equal(dst.wasCleaned(),true);
const p=JSON.parse(dst.stored.get('GE_SUN_LAB_MODE_PROFILES_V3'));
assert.equal(p.waterfall.pulseDepth,99,'iPhone receives saved pulse depth');
assert.equal(p.waterfall.pulseRelease,92,'iPhone receives saved release speed');
assert.equal(p.spectrum.spectrumGain,125,'iPhone receives the other mode profile');
assert.equal(JSON.parse(dst.stored.get('GE_SUN_LAB_V7')).brightness,181);
assert.equal(dst.stored.get('GE_VAULT_ACCESS'),'UNCHANGED','EQ sharing must not touch Vault permissions');
console.log('PASS: actual beat contrast with rapid release; independent settings transfer desktop to phone.');
