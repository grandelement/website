import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('radio/motion-lab.html','utf8');
const css=fs.readFileSync('radio/ge-calm-motion.css','utf8');
const check=(ok,reason)=>assert.ok(ok,reason);
check(html.includes('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'),'Zoom stays enabled');
check(!/maximum-scale=1|user-scalable=no/.test(html),'No forced mobile zoom restriction');
for(const mode of ['soft','float','atmosphere','off'])check(html.includes('data-style="'+mode+'"'),'Mode exists: '+mode);
for(const tab of ['albums','songs','playlist'])check(html.includes('data-tab="'+tab+'"'),'Workspace exists: '+tab);
check(html.includes('id="content"')&&html.includes('id="audio"')&&html.includes('id="playerPlay"')&&html.includes('id="playerRepeat"'),'One workspace and persistent demo player');
check(html.includes("document.startViewTransition")&&html.includes('prefers-reduced-motion'),'Progressive transitions and reduced-motion compatibility');
check(html.includes('data-ge-density="compact"')&&html.includes('id="compact"'),'Compact layout switch');
check(html.includes('id="ambient"')&&html.includes('ge-motion-ambient'),'Ambient control');
check(css.includes('[data-ge-motion="off"]')&&css.includes('@media(prefers-reduced-motion:reduce)'),'Motion opt-out');
check(css.includes('animation:ge-ambient-breathe 12s')&&html.includes('data-ge-ambient="off"'),'Ambient layer is opt-in');
check(!/autoplay(?:\s|>|=)/i.test(html),'Audio requires a gesture');
check(html.includes("disabled title=\"This lab does not connect to checkout\""),'No simulated charges');
for(const album of ['Aether','Fire','Spirit','Love']){
 check(fs.existsSync('ge-images/images/Grand Element - '+album+'.jpg'),'Album cover exists: '+album);
}
for(const song of ['Aether_02-Gravity.mp3','Aether_04-Prana.mp3','Aether_06-Polaris.mp3']){
 const path='ge-music/music/Grand Element - 2026 - Aether/'+song;
 check(fs.existsSync(path),'Preview song exists: '+path);
}
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
check(scripts.length===1,'One inline preview controller');
const vm=await import('node:vm');
new vm.Script(scripts[0][1],{filename:'radio/motion-lab.html:script'});
console.log('PASS: GE Calm Motion Lab static, assets, JavaScript syntax and accessibility guards.');
