import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('rainbow only for a confirmed different production revision',async()=>{
 const a='a'.repeat(40),b='b'.repeat(40);let remote=a,online=true,last;
 const storage=new Map(),window={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},addEventListener(){}};
 const navigator={get onLine(){return online}};
 vm.runInNewContext(readFileSync('radio/website-update.js','utf8'),{window,navigator,location:{href:'https://example.test/radio/'},URL,AbortController,setTimeout,clearTimeout,fetch:async()=>new Response(JSON.stringify({revision:remote}),{headers:{'content-type':'application/json'}})});
 const engine=window.GEWebsiteUpdate;engine.subscribe(s=>last=s);
 await engine.check();assert.equal(last.available,false);
 await engine.check();assert.equal(last.available,false);
 remote=b;await engine.check();assert.equal(last.available,true);
 online=false;await engine.check();assert.equal(last.available,false);
 online=true;remote='invalid';await engine.check();assert.equal(last.available,false);
 remote=a;await engine.check();assert.equal(last.available,false);
});
test('update is production-based, preserves data and is included in the offline startup shell',()=>{
 const music=readFileSync('radio/ge-music-v5.js','utf8'),update=readFileSync('radio/website-update.js','utf8');
 assert.match(music,/data-update-available="true"/);
 assert.match(music,/geWebsiteRainbow 4s linear infinite/);
 assert.doesNotMatch(update,/(?:localStorage|sessionStorage)\.clear\(|caches\.delete\(|unregister\(/);
 assert.match(readFileSync('radio/release-version.json','utf8'),/site\.github\.build_revision/);
 assert.match(readFileSync('radio/sw.js','utf8'),/\.\/website-update\.js/);
});
