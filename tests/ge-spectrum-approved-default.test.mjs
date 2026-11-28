import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const approved=JSON.parse(read('config/spectrum-approved-default.json')).profile;
const radio=read('radio/index.html');
const live=JSON.parse(read('config/site-live.json'));
function sunEQ(x){
  for(const [k,v] of Object.entries(x)){
    if(k==='sunEQ')return v;
    if(v&&typeof v==='object'){const result=sunEQ(v);if(result)return result;}
  }
}
const match=radio.match(/^\s*spectrum:(\{"waveType":"spectrum"[^\n]+\}),$/m);
assert.ok(match,'Approved Spectrum fallback must exist');
assert.deepEqual({effectTransparency:0,...JSON.parse(match[1])},approved,'Protected fallback changed');
assert.deepEqual({effectTransparency:0,...sunEQ(live).profiles.spectrum},approved,'Published Spectrum differs from owner-approved permanent baseline. Restore it or obtain explicit approval for a new default.');
assert.ok(radio.includes("sunLabEditMode==='spectrum'?null:publishedSunEQ?.profiles?.[sunLabEditMode]"),'Spectrum Reset This Effect must restore the approved fallback');
console.log('PASS: complete approved Spectrum baseline, published preset, and recovery reset agree.');
