import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('radio/ordered-audio.js','utf8');
test('ordered playback buffers next recording without persistent storage or another audio element',async()=>{
 const events={},window={addEventListener(){}},first='https://example.test/ge-music/music/a.mp3',next='https://example.test/ge-music/music/b.mp3';
 let requested=next,src=first,fetches=0;
 const audio={paused:false,ended:false,duration:100,currentTime:80,getAttribute(){return src},addEventListener(k,f){events[k]=f}};
 vm.runInNewContext(source,{window,location:{href:first,origin:'https://example.test'},URL,Blob,AbortController,fetch:async url=>{
  assert.equal(url,next);fetches++;return new Response(new Uint8Array(256),{headers:{'Content-Type':'audio/mpeg'}})
 }});
 const engine=window.GEOrderedAudio.create(audio,()=>requested);
 events.timeupdate();await new Promise(r=>setTimeout(r,30));
 src=engine.select(next);assert.match(src,/^blob:/);assert.equal(engine.source(),next);assert.equal(fetches,1);
 requested='';engine.clear();assert.equal(engine.select(first,{ordered:false}),first);
});
test('both ordered transports and offline shell use the same prebuffer module',()=>{
 for(const path of ['radio/index.html','radio/preview-lab.html'])assert.match(readFileSync(path,'utf8'),/GEOrderedAudio\?\.create/);
 assert.match(readFileSync('radio/sw.js','utf8'),/\.\/ordered-audio\.js/);
 assert.match(readFileSync('radio/index.html','utf8'),/state\.shuffle&&shouldInsertStation\(\)/);
});

test('the four owner-marked transitions start preparation at the beginning, including offline URLs',async()=>{
 const folder='https://example.test/ge-music/music/Grand%20Element%20-%202026%20-%20Aether/';
 const first=folder+'Aether_01-The%20Journey%20I.mp3',next=folder+'Aether_01-The%20Journey%20II.mp3?ge_offline=1';
 let requested=next,src=first,calls=0;
 const events={},window={addEventListener(){}};
 const audio={paused:false,ended:false,duration:300,currentTime:0,dataset:{},getAttribute(){return src},addEventListener(k,f){events[k]=f}};
 vm.runInNewContext(source,{window,location:{href:first,origin:'https://example.test'},URL,Blob,AbortController,fetch:async url=>{
  assert.equal(url,next);calls++;return new Response(new Uint8Array(256),{headers:{'Content-Type':'audio/mpeg'}})
 }});
 const api=window.GEOrderedAudio,engine=api.create(audio,()=>requested);
 assert.equal(api.immediate(first,next),true);
 assert.equal(api.immediate(next,folder+'Aether_01-The%20Journey%20III.mp3'),true);
 const intergy='https://example.test/ge-music/music/Grand%20Element%20-%202010%20-%20Intergy/';
 assert.equal(api.immediate(intergy+'Intergy_02_Intergy.mp3',intergy+'Intergy_03_Amuse.mp3'),true);
 assert.equal(api.immediate(intergy+'Intergy_06_You%20Cant%20Change%20Me.mp3',intergy+'Intergy_07_Selfishteem.mp3'),true);
 assert.equal(api.immediate(first,intergy+'Intergy_03_Amuse.mp3'),false);
 events.playing();assert.equal(audio.dataset.geNextTrackState,'preparing');
 await new Promise(r=>setTimeout(r,30));
 assert.equal(audio.dataset.geNextTrackState,'ready');assert.equal(calls,1);
 audio.currentTime=292;events.timeupdate();assert.equal(calls,1);
 src=engine.select(next);assert.match(src,/^blob:/);assert.equal(engine.source(),next);
 assert.equal(audio.dataset.geNextTrackState,'');
});
