import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const settingsSource=fs.readFileSync('dj/imac-upload-settings.js','utf8');
const uploadsSource=fs.readFileSync('dj/imac-uploads.js','utf8');
const workstationSource=fs.readFileSync('dj/imac-workstation.js','utf8');
const html=fs.readFileSync('dj/imac.html','utf8');
const helper=fs.readFileSync('dj/ge-upload-helper.py','utf8');

new vm.Script(settingsSource);
new vm.Script(uploadsSource);
new vm.Script(workstationSource);

function preset(mode,overrides={},options={}){
 const storage={getItem(){return JSON.stringify({...options,mode,revision:'02',
  fields:{title:{enabled:true,auto:true,value:''},artist:{enabled:true,auto:true,value:''},
   album:{enabled:true,auto:true,value:''},track:{enabled:true,auto:true,value:''},
   date:{enabled:true,auto:true,value:''},...overrides}});}};
 const window={localStorage:storage};
 const document={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(settingsSource,{window,document,Date,JSON,RegExp,String,Number,Array,Object,Math});
 return window.GEImacUploadSettings;
}
const song={name:'Intergy_02_Intergy.mp3'};
assert.match(preset('draft').nameFor(song),/^\d{4}-\d{2}-\d{2} - 02 - Intergy\.mp3$/);
assert.equal(preset('radio').nameFor(song),'Intergy_02_Intergy.mp3');
assert.equal(preset('final').nameFor(song),
 'Grand Element - '+new Date().getFullYear()+' - Intergy - 02 - Intergy.mp3');
const finalCustom=preset('final',{
 album:{enabled:true,auto:false,value:'Fire'},
 track:{enabled:true,auto:false,value:'02103'}
});
assert.equal(finalCustom.nameFor({name:'Alignment.mp3'}),
 'Grand Element - '+new Date().getFullYear()+' - Fire - 02103 - Alignment.mp3');
assert.match(finalCustom.validate({name:'Alignment.mp3'}),/^$/);
assert.ok(!preset('draft').tagsFor(song).title,'Draft tag embedding must be off');
// Covers in the METADATA selector must match actual files in GitHub.
const covers=preset('final').albumCovers();
assert.equal(covers.length,11,'All eleven GE Studios covers must be selectable');
for(const cover of covers){
 assert.match(cover.path,/^\/ge-images\/images\/Grand%20Element%20-%20[\w%.-]+\.jpg$/);
 const filePath=decodeURIComponent(cover.path).replace(/^\//,'');
 assert.ok(fs.existsSync(filePath),'Album cover missing from GitHub: '+filePath);
}
const fire=covers.find(c=>c.album==='Fire');
const fireSaved=preset('final',{
 album:{enabled:true,auto:false,value:'Fire'}
},{coverEnabled:true,coverPath:fire.path});
assert.equal(fireSaved.coverFor().url,fire.path,'Saved Github album cover must reopen on iMac');
assert.equal(fireSaved.coverFor().type,'image/jpeg','Album artwork must upload as JPEG');
assert.equal(fireSaved.validate({name:'Fire_02_Alignment.mp3'}),'','Saved cover must satisfy FINAL validation');
assert.equal(preset('final',{}, {coverEnabled:true,coverPath:'/not/allowed.jpg'}).coverFor(),null,
 'Unknown cover paths cannot be loaded');
assert.ok(uploadsSource.includes('imageReq.responseType="blob"'),'Browser must fetch JPG from site');
assert.ok(uploadsSource.includes('imageReq.open("GET",cover.url,true)'),'Cover URL must fetch same-origin');
assert.ok(uploadsSource.includes('stageCover(binary)'),'Retrieved cover must reach local helper');
for(const tag of ['geUploadNameQuick','geUploadMetadataPanel','fileRadio','listRadio','uploadRadio'])
 assert.ok(html.includes(tag),'Missing UI '+tag);
for(const fn of ['/rename','/copy-to','/cover','&format=2&metadata='])
 assert.ok(uploadsSource.includes(fn),'Missing frontend '+fn);
assert.ok(helper.includes('"helper_version": 10'),'New helper must be V10');
assert.ok(helper.includes('Destination filename already exists. No overwrite.'));
assert.ok(workstationSource.includes('move(studioConnection,statusDetails)'),'Repair must be under STATUS');
assert.ok(workstationSource.includes('"FILES",filesView],["METADATA",metadataView],["STATUS",statusView]'));
assert.ok(workstationSource.includes('showResult("COMPLETE",source)'));
assert.ok(!workstationSource.includes('move(diagnostic,settingsView)'));
console.log('PASS GE iMac naming, Radio, rename, metadata and STATUS layout');
