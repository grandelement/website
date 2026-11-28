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
