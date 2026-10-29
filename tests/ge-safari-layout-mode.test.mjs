import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';

const paths=['index.html','radio/index.html'];
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';
const desktopSafariOnIPhone='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15';
const android='Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/132 Mobile Safari/537.36';
const realMac='Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const scripts=paths.map(path=>{
 const html=readFileSync(path,'utf8');
 const script=html.match(/<script id="ge-safari-request-website-mode">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,path+' is missing its canonical early device detector');
 new Script(script);
 return script;
});
assert.equal(scripts[0],scripts[1],'Home and Radio must use exactly the same detector');

function run(ua,width,height,touch=5,query='',saved={},standalone,landscape=false){
 const classes=new Set(),storage={...saved};
 const viewport={content:'width=device-width,initial-scale=1,viewport-fit=cover'};
 const html={dataset:{},classList:{
   toggle:(name,value)=>value?classes.add(name):classes.delete(name),
   contains:name=>classes.has(name),
   add:name=>classes.add(name)
 }};
 const loc={search:query,href:'https://www.grandelement.com/radio/',assign:url=>{loc.assigned=url;}};
 const localStorage={
   getItem:key=>storage[key]??null,
   setItem:(key,value)=>{storage[key]=String(value);}
 };
 const handlers={};
 const window={
   matchMedia:()=>({matches:landscape}),
   addEventListener:(event,fn)=>{handlers[event]=fn;}
 };
 const navigator={userAgent:ua,maxTouchPoints:touch};
 if(standalone!==undefined)navigator.standalone=standalone;
 const ctx=createContext({
   navigator,screen:{width,height},location:loc,localStorage,
   URL,URLSearchParams,window,document:{
     documentElement:html,
     querySelector:selector=>selector==='meta[name="viewport"]'?viewport:null
   }
 });
 new Script(scripts[0]).runInContext(ctx);
 return {mode:html.dataset.geDeviceLayout,preference:html.dataset.geDevicePreference,
   classes,viewport:viewport.content,storage,window,handlers,location:loc};
}
for(const ua of [iphone,desktopSafariOnIPhone]){
 const p=run(ua,390,844,5);
 assert.equal(p.mode,'mobile','physical iPhone must be mobile, even with Macintosh UA');
 assert.equal(p.preference,'auto','automatic is the default');
 assert.equal(p.viewport,'width=390,initial-scale=1,viewport-fit=cover');
 assert.ok(!p.classes.has('ge-safari-desktop-request'),'no fake desktop styling by default');
 assert.equal(run(ua,844,390,5,'',{},false,true).viewport,'width=844,initial-scale=1,viewport-fit=cover');
}
assert.equal(run(desktopSafariOnIPhone,390,844,0,'',{},false).mode,'mobile',
  'iOS Safari standalone clue identifies an iPhone even if touch points are spoofed');
assert.equal(run(android,412,915).mode,'mobile');
assert.equal(run(desktopSafariOnIPhone,820,1180).mode,'mobile','touch tablet gets mobile mode');
assert.equal(run(realMac,1440,900,0).mode,'desktop','real Macintosh remains desktop');
const key='GE_DEVICE_VIEW_PREFERENCE_V1';
const mobileChoice=run(desktopSafariOnIPhone,390,844,5,'?ge_view=mobile');
assert.equal(mobileChoice.storage[key],'mobile','explicit mobile saves the device preference');
assert.equal(run(desktopSafariOnIPhone,390,844,5,'',mobileChoice.storage).mode,'mobile',
 'saved mobile applies on another page without a query parameter');
const manualDesktop=run(desktopSafariOnIPhone,390,844,5,'?ge_view=desktop');
assert.equal(manualDesktop.mode,'desktop');
assert.equal(manualDesktop.viewport,'width=1160,initial-scale=1,viewport-fit=cover');
assert.ok(manualDesktop.classes.has('ge-safari-desktop-request'));
assert.equal(run(desktopSafariOnIPhone,390,844,5,'',manualDesktop.storage).mode,'desktop',
 'only explicitly saved desktop preference enables virtual desktop');
const automaticReset=run(desktopSafariOnIPhone,390,844,5,'?ge_view=auto',manualDesktop.storage);
assert.equal(automaticReset.storage[key],'auto');
assert.equal(automaticReset.mode,'mobile','AUTO clears manual desktop and restores device detection');
automaticReset.window.GEDeviceView.setPreference('mobile');
assert.equal(automaticReset.storage[key],'mobile','view control stores preference');
assert.ok(automaticReset.location.assigned.includes('ge_view=mobile'),'view control changes current mode');
console.log('PASS: Home and Radio share a persisted iPhone-first view detector; Safari Macintosh UA and device rotation stay mobile; desktop opt-in is never automatic');
