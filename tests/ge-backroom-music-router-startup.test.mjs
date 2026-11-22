import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const router=await readFile(new URL('../backroom/music-router.js',import.meta.url),'utf8');
const found=router.match(/const changed=\(\)=>\s*([^;]+);/);
assert.ok(found,'Music routing must declare a change detector');
const expression=found[1];
// Execute the actual change expression against both pre- and post-load state.
const detect=new Function('loaded','snapshot','baseSignature','return Boolean('+expression+');');
let called=0;
const snapshot=()=>{called++;return '{"radioSongPaths":["song-a"]}';};
assert.equal(detect(false,snapshot,''),false,'first page load has no unsaved changes');
assert.equal(called,0,'the startup guard must not compare a non-existent published baseline');
const saved='{"radioSongPaths":["song-a"]}';
assert.equal(detect(true,snapshot,saved),false,'unchanged, loaded settings must remain clean');
assert.equal(detect(true,snapshot,'{"radioSongPaths":[]}'),true,
 'after loading, a genuinely changed checkbox must remain protected');
assert.match(router,/if\(changed\(\)&&!force&&!confirm\('Discard unsaved master checkboxes and refresh\?'\)\)return;/,
 'unsaved checkbox changes must still require confirmation on deliberate refresh');
assert.match(router,/if\(token\(\)&&!loaded\)void load\(\);/,
 'a stored session must still initialize the master data automatically');
console.log('PASS: first Back Room boot never prompts for a fake dirty Master; real post-load edits remain protected');
