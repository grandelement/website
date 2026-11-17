import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const js=await readFile(new URL('../backroom/publisher-worker.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;
const before={
 version:1,mode:'live',welcome:{enabled:true,title:'OLD'},
 about:{html:'old'},visual:{x:12},albums:{layout:'random'},
 easySettings:{speed:5},games:{},radioMoon:{visible:true},gateTiming:{enabled:false},
 merchandise:{size:100,speed:100,rotation:100,direction:'normal',quantity:2},
 music:{radioMasterSongPaths:['ge-music/music/protected.mp3'],
  catalogRouting:{assignments:{radio:'bangers'}},publicPlayer:{playlistId:'protected'},
  startupEnabled:true,firstTrack:{path:'ge-music/music/protected.mp3'}},
 protectedAdmin:'UNTOUCHED'
};
let record=structuredClone(before),sha='initial-sha',writes=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const uri=String(url);
 if(!uri.includes('/contents/config/site-live.json'))throw Error('Unexpected external URL '+uri);
 if(options.method==='PUT'){
  const request=JSON.parse(options.body);
  if(request.sha!==sha)return Response.json({message:'Conflict'},{status:409});
  record=JSON.parse(Buffer.from(request.content,'base64').toString('utf8'));
  writes++;sha='commit-'+writes;
  return Response.json({commit:{sha},content:{sha}});
 }
 return Response.json({sha,content:Buffer.from(JSON.stringify(record)).toString('base64')});
};
const host='https://ge-backroom-publisher.grandelement.workers.dev';
const env={BACKROOM_PASSWORD:'TEST',SESSION_SECRET:'long-strong-test-secret',
 GITHUB_TOKEN:'FAKE',GITHUB_OWNER:'grandelement',GITHUB_REPO:'website',GITHUB_BRANCH:'main'};
const req=(path,opts={})=>new Request(host+path,{
 ...opts,headers:{Origin:'https://grandelement.com','Content-Type':'application/json',...(opts.headers||{})}
});
try{
 let result=await worker.fetch(req('/manage/public-settings'),env);
 assert.equal(result.status,401,'Anonymous users cannot inspect private save service');
 result=await worker.fetch(req('/login',{method:'POST',body:JSON.stringify({password:'TEST'})}),env);
 assert.equal(result.status,200);
 const {token}=await result.json(),auth={Authorization:'Bearer '+token};
 result=await worker.fetch(req('/manage/public-settings',{headers:auth}),env);
 assert.equal(result.status,200);
 const initial=await result.json();
 assert.equal(initial.settings.welcome.title,'OLD');
 assert.equal(initial.settings['music.startupEnabled'],true);
 assert.equal('protectedAdmin' in initial.settings,false);

 const changes={welcome:{enabled:true,title:'NEW'},merchandise:{...before.merchandise,speed:225},
   'music.startupEnabled':false};
 const expected={welcome:before.welcome,merchandise:before.merchandise,'music.startupEnabled':true};
 result=await worker.fetch(req('/manage/public-settings',{method:'POST',headers:auth,
  body:JSON.stringify({changes,expected})}),env);
 assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
 const data=await result.json();assert.ok(data.commit);
 assert.equal(record.welcome.title,'NEW');
 assert.equal(record.merchandise.speed,225);
 assert.equal(record.music.startupEnabled,false);
 assert.deepEqual(record.music.catalogRouting,before.music.catalogRouting);
 assert.deepEqual(record.music.radioMasterSongPaths,before.music.radioMasterSongPaths);
 assert.deepEqual(record.music.publicPlayer,before.music.publicPlayer);
 assert.equal(record.protectedAdmin,'UNTOUCHED');
 result=await worker.fetch(req('/manage/public-settings',{headers:auth}),env);
 const readback=await result.json();
 for(const key of Object.keys(changes))assert.deepEqual(readback.settings[key],changes[key]);

 // Explicit scope block: public SAVE must never leak into private records or Radio.
 result=await worker.fetch(req('/manage/public-settings',{method:'POST',headers:auth,
  body:JSON.stringify({changes:{'music.radioMasterSongPaths':[]},expected:{'music.radioMasterSongPaths':[]}})}),env);
 assert.equal(result.status,400);
 result=await worker.fetch(req('/manage/public-settings',{method:'POST',headers:auth,
  body:JSON.stringify({changes:{welcome:{enabled:true,title:'STALE'}},expected:{welcome:before.welcome}})}),env);
 assert.equal(result.status,409,'Stale client cannot overwrite published website changes');
 result=await worker.fetch(req('/manage/public-settings',{method:'POST',
  body:JSON.stringify({changes,expected})}),env);
 assert.equal(result.status,401,'Anonymous cannot write');
 assert.equal(writes,1,'Only one valid GitHub save should occur');
 console.log('PASS: secure scoped website SAVE publishes/reads back to GitHub; preserves existing radio, DJ, master, player, private fields; refuses stale/unauthorized writes.');
}finally{globalThis.fetch=originalFetch}
