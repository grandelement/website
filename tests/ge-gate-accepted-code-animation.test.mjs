import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const source=readFileSync('radio/index.html','utf8');
const inline=[...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=|application\/json/i.test(m[1]));
for(const [i,m] of inline.entries())new Script(m[2],{filename:'radio-inline-'+i});

assert.match(source,/@keyframes geGateAcceptedCodeZoom\s*\{/);
assert.match(source,/#geGate\.unlocking #geGateSun\s*\{\s*animation:geGateAcceptedCodeZoom/);
assert.match(source,/#geGate\.unlocking #geGateBackdrop\s*\{animation:geGateAcceptedCodeBackdrop/);
assert.match(source,/function startVerifiedCodeExit\(\)/);
assert.match(source,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(\(\)=>\{/);
assert.match(source,/gate\.classList\.add\('unlocking'\)/);
assert.match(source,/gate\.style\.setProperty\('--ge-gate-unlock',\(duration\/1000\)\+'s'\)/);
assert.match(source,/if\(closeTimer&&gate\?\.classList\.contains\('open'\)\)return/);
const auth=source.indexOf("const response=await fetch('https://vault.grandelement.com/v1/public/access/redeem'");
const verified=source.indexOf("if(!response.ok||result.ok!==true)",auth);
const animate=source.indexOf('startVerifiedCodeExit();',verified);
const audio=source.indexOf('window.GEAudioGain?.restore?.()',animate);
assert.ok(auth>=0&&verified>auth&&animate>verified&&audio>animate,
 'Only a verified Vault Radio code starts the visual exit, before audio recovery.');
assert.match(source,/duration\+100\)/);
assert.doesNotMatch(source,/code\s*===?\s*['"]love['"]\s*&&\s*startVerifiedCodeExit/);
console.log('PASS: Every verified Radio code starts and completes the original Sun zoom/fade, independent of audio reconnect.');
