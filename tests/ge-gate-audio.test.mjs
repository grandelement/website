import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../radio/ge-gate-audio.js',import.meta.url),'utf8');
const listeners=new Map(),NOW=1_000_000;
function media(){
  return {muted:false,defaultMuted:false,paused:false,removed:false,loaded:false,
    pause(){this.paused=true},removeAttribute(name){if(name==='src')this.removed=true},
    load(){this.loaded=true}};
}
const main=media(),other=media();
class AudioParamMock{
  constructor(){this.events=[];this.value=1}
  cancelScheduledValues(t){this.events.push(['cancel',t])}
  setValueAtTime(v,t){this.events.push(['set',v,t]);this.value=v}
  linearRampToValueAtTime(v,t){this.events.push(['linear',v,t])}
}
class ContextMock{
  constructor(){
    this.state='running';this.currentTime=100;this.sampleRate=1000;
    this.destination={};this.gains=[];this.convolvers=[];
  }
  createMediaElementSource(element){
    assert.equal(element,main);this.mediaSourceCreated=true;
    return {connect(node){assert.ok(node)}};
  }
  createGain(){
    const gain={gain:new AudioParamMock(),connect(node){assert.ok(node)}};
    this.gains.push(gain);return gain;
  }
  createBiquadFilter(){
    return {frequency:{value:0},type:'',connect(node){assert.ok(node)}};
  }
  createConvolver(){
    const node={buffer:null,normalize:false,connect(to){assert.ok(to)}};
    this.convolvers.push(node);return node;
  }
  createBuffer(channels,size){
    const arrays=Array.from({length:channels},()=>new Float32Array(size));
    return {getChannelData(channel){return arrays[channel]}};
  }
  resume(){this.state='running';return Promise.resolve()}
}
let ctx,instances=0;
class ContextRecording extends ContextMock{
  constructor(){super();ctx=this;instances++}
}
const document={
  getElementById:id=>id==='player'?main:null,
  querySelectorAll:()=>[main,other],
  addEventListener(name,listener){listeners.set(name,listener)}
};
const window={AudioContext:ContextRecording,GEGate:{isExpiredLocked:()=>false}};
class Clock extends Date{static now(){return NOW}}
vm.runInNewContext(source,{window,document,Date:Clock,console},{filename:'ge-gate-audio.js'});
const controller=window.GEAudioGain;
assert.ok(controller);
assert.equal(controller.getStatus().active,false);

// Regression for natural Blue Sun: automatic scheduling MUST NOT create an
// AudioContext or reroute the playing iPhone audio outside a user gesture.
assert.equal(controller.scheduleFade(NOW+2000,NOW+12000),false);
assert.equal(instances,0,'automatic entrance must not hijack radio audio');
assert.equal(controller.getStatus().contextState,'uninitialized');

listeners.get('click')({
  isTrusted:true,
  target:{closest:selector=>selector.includes('#playBtn')?{}:null}
});
assert.equal(controller.getStatus().active,true);
assert.equal(controller.getStatus().reverb,true,'main player has audible reverb');
assert.equal(instances,1);
assert.equal(ctx.convolvers.length,1,'single-source room reverb created');
assert.equal(ctx.gains.length,3,'wet, dry and shared master buses');
assert.equal(controller.scheduleFade(NOW+2000,NOW+12000),true);
const master=ctx.gains[0].gain.events;
const dry=ctx.gains[1].gain.events;
const wet=ctx.gains[2].gain.events;
assert.ok(master.some(e=>e[0]==='set'&&e[1]===1&&e[2]===102),
  '2-second hold at full volume');
assert.ok(master.some(e=>e[0]==='linear'&&e[1]===0&&e[2]===112),
  '10-second fade ends in silence');
assert.ok(wet.some(e=>e[0]==='linear'&&e[1]===.55&&e[2]===109),
  'room reverb swells during the fade');
assert.ok(wet.some(e=>e[0]==='linear'&&e[1]===.40&&e[2]===112),
  'room reverb is upstream of final master silence');
assert.ok(dry.some(e=>e[0]==='linear'&&e[1]===.78&&e[2]===112),
  'dry signal slightly lowers while reverb rises');
const n=master.length;
controller.syncProgress(.25);
assert.equal(master.length,n,'animation frames must not cancel the audio-clock fade');
controller.scheduleFade(NOW-4000,NOW+6000);
assert.ok(master.some(e=>e[0]==='set'&&Math.abs(e[1]-.6)<.0001),
  'reconnecting within fade resumes with reduced gain');
controller.stopAll();
assert.equal(main.muted,true);
assert.equal(main.paused,true);
assert.equal(main.removed,true);
assert.equal(other.muted,true);
assert.equal(other.paused,true);
controller.restore();
assert.equal(controller.arm(),true);
console.log('Natural Gate, wet/dry room effect, 2+10 fade and cutoff pass');

const homeSource=fs.readFileSync(new URL('../radio/ge-home-gate-stop.js',import.meta.url),'utf8');
const homeAudio=media(),storage=new Map([
 ['GE_GATE_STATE_V5_3333',JSON.stringify({active:true,expired:true,expireAt:NOW-1})]
]);
const localStorage={getItem:key=>storage.get(key)||null};
const homeDoc={querySelectorAll:()=>[homeAudio],addEventListener(){}};
const homeWindow={addEventListener(){}};
vm.runInNewContext(homeSource,{window:homeWindow,document:homeDoc,localStorage,
  Date:Clock,setInterval(){}},{filename:'ge-home-gate-stop.js'});
assert.equal(homeAudio.paused,true);
assert.equal(homeAudio.muted,true);
console.log('Homepage expired Gate cutoff passes');
