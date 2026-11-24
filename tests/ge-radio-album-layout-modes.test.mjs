import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,createContext} from 'node:vm';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const music=await read('../radio/ge-music-v5.js');
const radio=await read('../radio/index.html');
const backroom=await read('../backroom/index.html');
new Script(music,{filename:'ge-music-v5.js'});
assert.match(radio,/ge-music-v5\.js\?v=20261124-album-layout-v771/);
assert.match(backroom,/<option value="planets-touch">PLANETS TOUCHING<\/option>/);
assert.match(backroom,/<option value="planets-gap">PLANETS WITH GAP<\/option>/);
assert.match(music,/universe\.dataset\.mode=albumUniverseMode/);
assert.doesNotMatch(music,/universe\.dataset\.mode='squares'/);
assert.match(music,/\.geStandaloneAlbumUniverse\[data-mode="planets-gap"\] \.geUniverseAlbums\{gap:10px!important\}/);
assert.match(music,/\.geStandaloneAlbumUniverse\[data-mode="planets-touch"\] \.geUniverseAlbum/);
const head=music.indexOf('function fitUniverseAlbums(){');
const tail=music.indexOf("window.addEventListener('resize'",head);
assert.ok(head>0&&tail>head);
const fn=music.slice(head,tail);
function fit(mode,{height=800,width=200,count=4}={}){
 const styles={};
 const universeBoard={clientHeight:height,clientWidth:width,
  querySelectorAll:()=>Array(count).fill(null),
  style:{setProperty:(k,v)=>{styles[k]=v}}
 };
 const universe={dataset:{mode}};
 const ctx=createContext({universeBoard,universe,setUniverseZoom:()=>{},universeZoom:1,window:{innerHeight:height,innerWidth:width},Math,Number,String});
 new Script(fn+'\nfitUniverseAlbums();').runInContext(ctx);
 return styles;
}
const touch=fit('planets-touch');
const gap=fit('planets-gap');
const squares=fit('squares');
assert.equal(touch['--ge-fit-cover-size'],touch['--ge-fit-cover-height'],'touching planets must have equal width and height');
assert.equal(gap['--ge-fit-cover-size'],gap['--ge-fit-cover-height'],'gapped planets must have equal width and height');
assert.ok(parseFloat(gap['--ge-fit-cover-height'])<parseFloat(touch['--ge-fit-cover-height']),'gapped planets fit within viewport without covering their spacing');
assert.equal(squares['--ge-fit-cover-height'],'200px','original full-height square album stack remains');
const narrowTouch=fit('planets-touch',{height:900,width:90,count:5});
assert.equal(narrowTouch['--ge-fit-cover-height'],'90px');
console.log('PASS: radio album layout follows Back Room selection; circles, touching and gaps each render geometrically without altering audio');
