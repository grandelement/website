import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';

const html=readFileSync('index.html','utf8');
// Album selection must activate the Album mode before an embedded player can return early.
const albumController=html.match(/playAlbum:\(albumTitle\)=>\{([\s\S]*?)\n    \},/);
assert.ok(albumController,'Home album controller is missing');
assert.ok(albumController[1].indexOf('setShuffleMode(false)')>=0,'Album control never switches to Album mode');
assert.ok(albumController[1].indexOf('setShuffleMode(false)')<albumController[1].indexOf('GE_SITE_ALBUM_PLAYER?.open'),
  'Embedded album player returns before Album mode lights up');
const dreamPick=html.match(/const album=b\.dataset\.autoAlbum\|\|'';([\s\S]*?)ensureMusic\(\);showAutopilotReady\(\);/);
assert.ok(dreamPick?.[1].includes('setShuffle?.(false)'),'DREAM album choice must show Album mode');

// The clock controller must fit the entire Blue Sun inside a resized viewport.
const clockScript=html.match(/<script id="ge-blue-sun-clock-home-v2">([\s\S]*?)<\/script>/)?.[1];
assert.ok(clockScript,'Blue Sun clock controller is missing');
const sun={
 style:{left:'1200px',top:'900px',transform:''},
 classList:{contains:()=>false},
 addEventListener:()=>{},
 getBoundingClientRect(){
   const w=92,h=92;
   const x=parseFloat(this.style.left),y=parseFloat(this.style.top);
   return {left:x-w/2,top:y-h/2,right:x+w/2,bottom:y+h/2,width:w,height:h};
 }
};
const queue=[],handlers={};
const context=createContext({
 innerWidth:390,innerHeight:844,Math,Date,
 performance:{now:()=>0},
 setTimeout:fn=>queue.push(fn),
 requestAnimationFrame:fn=>queue.push(fn),
 window:{addEventListener:(kind,fn)=>{handlers[kind]=fn}},
 document:{hidden:false,body:{classList:{contains:()=>false}},
   getElementById:id=>id==='sunWrap'?sun:null}
});
new Script(clockScript).runInContext(context);
function assertSunVisible(){
 const r=sun.getBoundingClientRect();
 assert.ok(r.left>=-0.1 && r.top>=-0.1,'Blue Sun extends beyond top/left edge');
 assert.ok(r.right<=context.innerWidth+0.1 && r.bottom<=context.innerHeight+0.1,
   'Blue Sun extends beyond bottom/right edge');
}
queue.shift()(100);
assertSunVisible();
sun.style.left='1200px';sun.style.top='900px';
context.innerWidth=320;context.innerHeight=600;
queue.shift()(200);
assertSunVisible();
assert.match(html,/const keep = 1; \/\/ The complete Blue Sun stays on-screen\./,
  'Dragging may place Blue Sun off-screen');
assert.match(html,/--sun-size: 92px;/,'Mobile Blue Sun size must stay compact');
console.log('PASS: Home album choice activates Album mode; Blue Sun fits initial and resized viewports');
