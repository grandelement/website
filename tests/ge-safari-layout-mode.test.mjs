import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

// Verify the same device detection runs before layout CSS on both entry pages.
const pages=['index.html','radio/index.html'];
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const iphoneDesktop='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const android='Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0 Mobile Safari/537.36';
const mac='Mozilla/5.0 (Macintosh; Intel Mac OS X 13_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
function detect(source,ua,width,height,touchPoints,search=''){
  const classes=new Set();
  const viewport={content:'width=device-width,initial-scale=1,viewport-fit=cover'};
  const html={
    dataset:{},
    classList:{
      add:name=>classes.add(name),
      contains:name=>classes.has(name),
      toggle:(name,on)=>on?classes.add(name):classes.delete(name)
    }
  };
  const context=createContext({
    navigator:{userAgent:ua,maxTouchPoints:touchPoints},
    screen:{width,height},
    location:{search},
    URLSearchParams,
    document:{documentElement:html,querySelector:selector=>selector==='meta[name="viewport"]'?viewport:null}
  });
  new Script(source).runInContext(context);
  return {mode:html.dataset.geDeviceLayout,classes,viewport:viewport.content};
}
for(const page of pages){
 const markup=readFileSync(page,'utf8');
 const match=markup.match(/<script id="ge-safari-request-website-mode">([\s\S]*?)<\/script>/);
 assert.ok(match,'GE Safari layout script must exist on '+page);
 const js=match[1];
 new Script(js);
 const phone=detect(js,iphone,390,844,5);
 assert.equal(phone.mode,'mobile',page+' iPhone default mobile');
 assert.ok(phone.classes.has('ge-mobile-device'));
 assert.ok(!phone.classes.has('ge-safari-desktop-request'));
 assert.match(phone.viewport,/device-width/);
 // Macintosh UA alone does not justify desktop mode on a physical iPhone.
 // On Safari it can be caused by a default site setting, not deliberate choice.
 const macLikePhone=detect(js,iphoneDesktop,390,844,5);
 assert.equal(macLikePhone.mode,'mobile',page+' compact touchscreen uses mobile by default');
 assert.ok(macLikePhone.classes.has('ge-mobile-device'));
 assert.ok(!macLikePhone.classes.has('ge-safari-desktop-request'));
 assert.match(macLikePhone.viewport,/device-width/);
 // Orientation never changes the physical-device classification.
 assert.equal(detect(js,iphoneDesktop,844,390,5).mode,'mobile');
 assert.equal(detect(js,iphone,844,390,5).mode,'mobile');
 // Deliberate site view selection remains possible without guessing Safari UI intent.
 const desktop=detect(js,iphoneDesktop,390,844,5,'?ge_view=desktop');
 assert.equal(desktop.mode,'desktop',page+' explicit desktop override');
 assert.ok(desktop.classes.has('ge-safari-desktop-request'));
 assert.equal(desktop.viewport,'width=1160,viewport-fit=cover');
 assert.equal(detect(js,iphoneDesktop,390,844,5,'?ge_view=mobile').mode,'mobile');
 assert.equal(detect(js,iphone,390,844,5).mode,'mobile');
 assert.equal(detect(js,android,412,915,5).mode,'mobile');
 assert.equal(detect(js,mac,1440,900,0).mode,'desktop');
}
console.log('PASS: GE homepage + Radio mobile auto-detection and explicit desktop/mobile override without false-positive desktop UA');
