import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../radio/ge-gate-audio.js',import.meta.url),'utf8');
const listeners=new Map();
const NOW=1_000_000;
function media(){
  return {
    muted:false,defaultMuted:false,paused:false,removed:false,loaded:false,
    pause(){this.paused=true},removeAttribute(name){if(name==='src')this.removed=true},
    load(){this.loaded=true}
  };
}
const main=media(),other=media();
class AudioParamMock{
  constructor(){this.events=[];this.value=1}
  cancelScheduledValues(time){this.events.push(['cancel',time])}
  setValueAtTime(value,time){this.events.push(['set',value,time]);this.value=value}
  linearRampToValueAtTime(value,time){this.events.push(['linear',value,time])}
}
class ContextMock{
  constructor(){this.state='running';this.currentTime=100;this.destination={};this.gain=null}
  createMediaElementSource(element){
    assert.equal(element,main);
    return {connect(){}};
  }
  createGain(){this.gain={gain:new AudioParamMock(),connect(){}};return this.gain}
  resume(){this.state='running';return Promise.resolve()}
}
let ctx;
class ContextRecording extends ContextMock{constructor(){super();ctx=this}}
const document={
  getElementById:id=>id==='player'?main:null,
  querySelectorAll:()=>[main,other],
  addEventListener(name,listener){listeners.set(name,listener)}
};
const window={AudioContext:ContextRecording,GEGate:{isExpiredLocked:()=>false}};
class Clock extends Date{static now(){return NOW}}
vm.runInNewContext(source,{window,document,Date:Clock,console}, {filename:'ge-gate-audio.js'});
const controller=window.GEAudioGain;
assert.ok(controller,'audio controller must be exposed');
assert.equal(controller.getStatus().active,false,'no boot autoplay graph');
assert.equal(controller.arm(),true);
assert.equal(controller.getStatus().active,true);
assert.equal(controller.scheduleFade(NOW+2000,NOW+12000),true);
const events=ctx.gain.gain.events;
assert.ok(events.some(e=>e[0]==='set'&&e[1]===1&&e[2]===102),'hold full volume for two seconds');
assert.ok(events.some(e=>e[0]==='linear'&&e[1]===0&&e[2]===112),'zero gain by 10-second end');
const n=events.length;
controller.syncProgress(0.25);
assert.equal(events.length,n,'animation frames must not cancel scheduled fade');
controller.scheduleFade(NOW-4000,NOW+6000);
assert.ok(events.some(e=>e[0]==='set'&&Math.abs(e[1]-.6)<.0001),'resume mid-fade at reduced volume');
controller.stopAll();
assert.equal(main.muted,true);
assert.equal(main.paused,true);
assert.equal(main.removed,true);
assert.equal(other.muted,true);
assert.equal(other.paused,true);
assert.equal(controller.getStatus().active,true);
controller.restore();
assert.equal(controller.arm(),true);
console.log('Website-only Gate audio scheduling/cutoff tests passed');
