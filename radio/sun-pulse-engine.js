/* GE Sun: real-audio-only transient expansion.
   Changes visual energy, NEVER the speaker audio, Gate, or listener volume.
   No prerecorded song maps, oscillators, or synthetic beat playback. */
(()=>{
'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number(x)||0));
function create(){
let floor=[],peak=[],previous=[],envelope=[],result=null,lastTime=0;
function reset(){floor=[];peak=[];previous=[];envelope=[];result=null;lastTime=0;}
function process(raw,opts={},time=performance.now()){
  if(!raw?.length)return null;
  const n=raw.length;
  if(!result||result.length!==n){
    floor=new Float32Array(n);
    peak=new Float32Array(n).fill(.10);
    previous=new Float32Array(n);
    envelope=new Float32Array(n);
    result=new Uint8Array(n);
    lastTime=0;
  }
  const depth=clamp((opts.pulseDepth??82)/100);
  const sensitivity=.55+clamp((opts.pulseSensitivity??70)/100)*2.15;
  const noise=.012+clamp((opts.pulseNoiseFloor??12)/100)*.24;
  const attack=.12+clamp((opts.pulseAttack??85)/100)*.86;
  const release=.018+clamp((opts.pulseRelease??72)/100)*.48;
  // Preserve attack and release time constants at different screen refresh rates.
  const elapsed=lastTime?clamp((time-lastTime)/33, .33, 3):1;
  lastTime=time;
  const up=1-Math.pow(1-attack,elapsed);
  const down=1-Math.pow(1-release,elapsed);
  for(let i=0;i<n;i++){
    const v=clamp(raw[i]/255);
    // Track continuous loudness slowly but follow quiet passages promptly.
    const f=floor[i] += (v-floor[i])*(v<floor[i]?.07:.012);
    const excess=Math.max(0,v-f-noise*.35);
    peak[i]=Math.max(excess,peak[i]*Math.pow(.988,elapsed),.045);
    const relative=clamp(excess/peak[i]);
    // A rising edge responds to a new drum strike, not to overall brightness.
    const onset=clamp(Math.max(0,v-previous[i])*sensitivity*9);
    const beat=clamp(Math.max(relative*.16,onset));
    const contrast=clamp((beat-noise)*sensitivity);
    const shape=Math.pow(contrast,1+depth*1.15);
    const target=clamp(v*(1-depth)*.85+shape*depth);
    const last=envelope[i];
    envelope[i]=last+(target-last)*(target>last?up:down);
    result[i]=Math.round(clamp(envelope[i])*255);
    previous[i]=v;
  }
  return result;
}
return {process,reset};
}
window.GESunPulseEngine={...create(),create};
})();