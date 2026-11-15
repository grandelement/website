import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sw=read('sw.js'), library=read('ge-offline-library.js'), radio=read('radio/index.html');
new vm.Script(sw,{filename:'sw.js'});
new vm.Script(library,{filename:'ge-offline-library.js'});
assert.match(sw,/const REQUIRED_OFFLINE_FILES=/,'Full website must cache required files');
for(const p of ['./radio/','./radio/index.html','./radio/offline-player.html','./ge-offline-library.js']){
 assert.ok(sw.includes("'"+p+"'"),p+' must be cached at install');
}
assert.match(sw,/for\(const path of REQUIRED_OFFLINE_FILES\)/,'Worker install must verify required files');
assert.match(sw,/throw new Error\('Offline website missing required file/,'A failed core download stops activation');
assert.match(sw,/blob\.slice\(start,end\+1\)/,'Byte ranges use Blob rather than a huge ArrayBuffer');
assert.match(library,/const fullySaved=urls.length>0 && !missing.length && fail===0 && skipped===0 && done===urls.length/,'READY must require every file, including music');
assert.match(library,/response.status!==200/,'Reject HTTP 206 or other partial song responses');
assert.match(library,/Cached file failed local verification/,'Verify after saving audio');
assert.match(library,/await valid\(await cache.match/,'Verify actual cached audio instead of trusting any cached entry');
assert.doesNotMatch(radio,/if\(isSingles\(request\.url\) \|\| isStationID\(request\.url\)\)/,'Saved Singles cannot be excluded');
console.log('Root website offline readiness and music-cache checks passed');
