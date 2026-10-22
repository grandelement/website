import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(path,'utf8');
const module=read('ge-accessibility.js'),css=read('ge-accessibility.css');
const radio=read('radio/index.html'),home=read('index.html');
const parentSW=read('sw.js'),radioSW=read('radio/sw.js');
const siteControl=read('radio/website-live.js');
const preview=read('radio/preview-lab.html');
const manifest=JSON.parse(read('radio/manifest.json'));
let pass=0;
function test(v,why){assert.ok(v,why);console.log('PASS '+why);pass++;}
new vm.Script(module);
test(true,'Shared language and accessibility JavaScript compiles');
const begin=module.indexOf('const strings=');
const end=module.indexOf('\n};',begin);
test(begin>=0&&end>begin,'Translated control dictionary exists');
const dictionary=vm.runInNewContext(module.slice(begin,end+3)+'\nstrings');
test(['en','es','fr','de','nl','pt'].every(lang=>dictionary[lang]),'Six selectable languages exist');
for(const locale of Object.keys(dictionary)){
 for(const key of Object.keys(dictionary.en))test(typeof dictionary[locale][key]==='string'&&dictionary[locale][key].length>0,locale+' translates '+key);
}
for(const [path,source,assetPrefix] of [
 ['website',home,'./'],['radio',radio,'../']
]){
 test(source.includes(assetPrefix+'ge-accessibility.css?v='),path+' loads new styles');
 test(source.includes(assetPrefix+'ge-accessibility.js?v='),path+' loads shared controls');
 test(!/<meta name="viewport"[^>]*(?:maximum-scale|user-scalable=no)/i.test(source),path+' does not disable browser zoom at viewport');
}
test(home.includes('id="geLanguagePreference"'),'Site Music Options exposes persistent language selection');
test(module.includes("new MutationObserver(labelPlanets)")&&module.includes("el.setAttribute('role','button')"),'Album planets expose keyboard-operable actions');
test(module.includes("const picker=find('#trackList')")&&module.includes('returnTo.focus'), 'Radio track picker traps and restores keyboard focus');
test(module.includes("localStorage.setItem(localeKey,next)")&&module.includes("A.documentElement.classList.toggle('ge-access-zoom'"),'Language and opt-in zoom preferences are saved');
test(module.includes("new URL('/cdn-cgi/trace',location.origin)")&&!module.includes('ipify')&&!module.includes('ip-api.com'),'Country suggestion stays on origin; does not contact third-party IP service');
test(css.includes('ge-access-overflow')&&css.includes('overflow-y:auto!important'),'Text zoom and short screens keep controls scrollable rather than clipped');
test(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'Background controls occupy one row on guest phone screens');
test(css.includes('body.view-player')&&css.includes('var(--ge-fit-sun'),'Adaptive layout reserves room for Blue Sun');
test(css.includes('[data-ge-symbol]::before')&&css.includes('[data-ge-symbol]::after'),'Icon and visible text caption share one control');
test(css.includes('body.ge-offline-entitled #bottomActions #accessLaunchBtn'),'Owner-only CODE visibility remains protected');
test(home.includes('GE_A11Y_ZOOM')&&home.includes('zoomAllowed()'),'Universe pinch gesture lock honors explicit zoom preference');
test(radio.includes('id="bgGroup"')&&radio.includes('id="bottomActions"'),'Background and utility action groups remain separate');
test(siteControl.includes("target.searchParams.set('album',name)"),'Planet PLAY passes chosen album to music player');
test(preview.includes('WEBSITE_ALBUM_REQUEST')&&preview.includes('openAlbum(match)'),'Music player receives and opens requested album');
test(manifest.files.filter(path=>/Grand Element - 2026 - Aether\//.test(path)).length===4,'All four Aether tracks remain in Radio manifest');
for(const [label,source] of [['website',parentSW],['radio',radioSW]]){
 test(source.includes('ge-accessibility.js')&&source.includes('ge-accessibility.css'),label+' precaches shared accessibility assets');
}
console.log('GE accessibility contract passed: '+pass+' checks');
