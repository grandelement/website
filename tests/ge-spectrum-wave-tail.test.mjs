import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('radio/index.html','utf8');
const config=JSON.parse(fs.readFileSync('config/site-live.json','utf8'));
const defaults=JSON.parse(html.match(/^    spectrum:(\{"waveType":"spectrum".*?\}),$/m)[1]);
assert.deepEqual(config.visual.sunEQ.profiles.spectrum,defaults);
assert.equal(defaults.spectrumSpeed,6);
assert.equal(defaults.spectrumGain,300);
assert.equal(defaults.gap,63);
const start=html.indexOf('  function updateMeasuredTravelingSpectrum(');
const end=html.indexOf('  // Light is cast',start);
assert(start>=0&&end>start);
const context=vm.createContext({sunSpectrumSampleAt:0,sunSpectrumPhase:0,sunSpectrumBandHistory:[],
  SUN_RIPPLE_HISTORY_LIMIT:18000,sunNum:(key,fallback)=>defaults[key]??fallback,
  clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),sunEQAura:{offsetWidth:140},
  draws:[],clears:0,canvas:{width:100,height:100,getContext:()=>({clearRect:()=>context.clears++})},
  drawTravelingSpectrum:(canvas,head)=>{context.draws.push({distance:head.distance,levels:[...head.levels]});return 2;}});
vm.runInContext(html.slice(start,end),context);
const play=(now,live)=>context.updateMeasuredTravelingSpectrum(context.canvas,{low:.6,mid:.2,high:.1},live,now);
play(100,true);play(200,true);
const before=context.sunSpectrumPhase;
play(300,false);
assert(context.sunSpectrumPhase>before,'pause must not reset radial travel');
assert(context.sunSpectrumBandHistory.some(s=>s.levels[0]===.6),'measured history survives pause');
assert.deepEqual(context.draws.at(-1).levels,[0,0,0],'no fake signal while silent');
for(let t=400;t<1000;t+=100)play(t,false);
assert(context.sunSpectrumBandHistory.length<=4,'silence must not displace real history with zero samples');
play(1000,true);
assert(context.draws.at(-1).levels[0]===.6,'audio resumes measured emission');
for(let t=1100;t<17000;t+=100)play(t,false);
assert.equal(context.sunSpectrumBandHistory.length,0,'last real wave clears after leaving viewport');
assert(context.clears>0);
console.log('PASS: exact published defaults, silent tail propagation, resume and cleanup.');
