import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

// GE must not force desktop on a real iPhone just because Safari sends a Mac UA.
const pages=['index.html','radio/index.html'];
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const iphoneDesktopUA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const android='Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Mobile Safari/537.36';
const mac='Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
function detect(source,ua,width,height,touchPoints,query=''){
 const classes=new Set();
 const viewport={content:'width=device-width,initial-scale=1,viewport-fit=cover'};
 const html={
  dataset:{},
  classList:{
   add:name=>classes.add(name),
   contains:name=>classes.has(name),
   toggle:(name,on)=>{if(on)classes.add(name);else classes.delete(name);}
  }
 };
 const context=createContext({
  navigator:{userAgent:ua,maxTouchPoints:touchPoints},
  screen:{width,height},location:{search:query},URLSearchParams,
  document:{documentElement:html,querySelector:selector=>selector==='meta[name="viewport"]'?viewport:null}
 });
 new Script(source).runInContext(context);
 return {mode:html.dataset.geDeviceLayout,classes,viewport:viewport.content};
}
for(const page of pages){
 const markup=readFileSync(page,'utf8');
 const match=markup.match(/<script id="ge-safari-request-website-mode">([\s\S]*?)<\/script>/);
 assert.ok(match,'GE mobile detector missing on '+page);
 const js=match[1];new Script(js);
 for(const ua of [iphone,iphoneDesktopUA]){
  const phone=detect(js,ua,390,844,5);
  assert.equal(phone.mode,'mobile',page+' must recognize phone hardware');
  assert.ok(phone.classes.has('ge-mobile-device'));
  assert.ok(!phone.classes.has('ge-safari-desktop-request'));
  assert.match(phone.viewport,/device-width/);
  assert.equal(detect(js,ua,844,390,5).mode,'mobile','rotation must not force desktop');
 }
 const manualDesktop=detect(js,iphoneDesktopUA,390,844,5,'?ge_view=desktop');
 assert.equal(manualDesktop.mode,'desktop');
 assert.ok(manualDesktop.classes.has('ge-safari-desktop-request'));
 assert.equal(manualDesktop.viewport,'width=1160,viewport-fit=cover');
 const manualMobile=detect(js,iphoneDesktopUA,390,844,5,'?ge_view=mobile');
 assert.equal(manualMobile.mode,'mobile');
 assert.match(manualMobile.viewport,/device-width/);
 assert.equal(detect(js,android,412,915,5).mode,'mobile');
 assert.equal(detect(js,iphoneDesktop,820,1180,5).mode,'mobile',page+' iPad-style Mac UA is touch tablet');
 assert.equal(detect(js,iphoneDesktop,1440,900,0).mode,'desktop',page+' actual desktop has no touch points');
 assert.equal(detect(js,mac,1440,900,0).mode,'desktop');
}
console.log('PASS: homepage + Radio recognize actual phones, do not widen iPhone viewport, respect explicit GE view override');
