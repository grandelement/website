import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const read=async path=>readFile(new URL(path,import.meta.url),'utf8');
const vaultSource=await read('../vault-worker/src/index.js');
const publisherSource=await read('../backroom/publisher-worker.js');
const ui=await read('../backroom/index.html');
const drilldown=await read('../backroom/fan-visitor-drilldown.js');
const vault=(await import('data:text/javascript;base64,'+Buffer.from(vaultSource).toString('base64'))).default;
const publisher=(await import('data:text/javascript;base64,'+Buffer.from(publisherSource).toString('base64'))).default;
assert.match(ui,/fan-visitor-drilldown\.js/);
assert.match(ui,/GE_BACKROOM_OPEN_REGION_VISITORS/);
assert.match(ui,/GE_BACKROOM_OPEN_FAN_PROFILE/);
for(const phrase of ['VIEW ALL VISITOR IDS','BACK TO VISITOR LIST','BACK TO ALL REGIONS','ADD TO SAVED FANS','ACTIVITY HISTORY']){
 assert.ok(drilldown.includes(phrase),'missing UI action: '+phrase);
}
assert.doesNotThrow(()=>new Function(drilldown),'visitor UI script must be valid JS');
let writes=0,reads=0,seen=[];
const id='visitor-abcdef1234567890';
const db={prepare(sql){
 reads++;seen.push(sql);
 return {bind(...args){this.args=args;return this;},
  async all(){
   if(sql.includes('GROUP BY e.anon_id'))return {results:[
    {anon_id:id,last_activity:1795305000,events:32,sessions:5,fan_id:null,fan_name:null,country:'US',region:'Alabama'}]};
   if(sql.includes('SELECT occurred_at,event_type,surface,page_path'))return {results:[
    {occurred_at:1795305000,event_type:'page_view',surface:'website',page_path:'/music',track_title:null,session_id:'test-session',fan_id:null,country:'US',region:'Alabama'},
    {occurred_at:1795304000,event_type:'track_start',surface:'radio',page_path:'/radio',track_title:'PEACE!',session_id:'test-session',fan_id:null,country:'US',region:'Alabama'}
   ]};
   if(sql.includes('FROM fan_music_playlists'))return {results:[]};
   if(sql.includes('GROUP BY country,region'))return {results:[]};
   if(sql.includes('GROUP BY event_type'))return {results:[]};
   return {results:[]};
  },
  async first(){
   if(sql.includes('SELECT display_name FROM fans'))return {display_name:'Saved fan'};
   if(sql.includes('COUNT('))return {events:32,visitors:5,sessions:5,last_seen:1795305000};
   return null;
  },
  async run(){writes++;return {success:true};}
 };
}};
const venv={VAULT_ACCESS_CODES_TOKEN:'SCOPED_TEST_KEY',
 VAULT_ADMIN_TOKEN:'ADMIN_TEST_KEY',VAULT_DB:db,VAULT_HASH_KEY:'TEST_HASH'};
const origin='https://grandelement.com';
async function vaultGet(path,auth=''){
 return vault.fetch(new Request('https://vault.grandelement.com'+path,{
  headers:{Origin:origin,...(auth?{Authorization:'Bearer '+auth}:{})}
 }),venv);
}
const query='?period=24h&state=Alabama&country=US';
let response=await vaultGet('/v1/admin/fan-visitors'+query);
assert.equal(response.status,401,'no anonymous access');
response=await vaultGet('/v1/admin/fan-visitors'+query,'SCOPED_TEST_KEY');
assert.equal(response.status,200);
let result=await response.json();
assert.equal(result.visitors.length,1);
assert.equal(result.visitors[0].events,32);
assert.equal(result.visitors[0].region,'Alabama');
assert.equal('ip_hash' in result.visitors[0],false);
response=await vaultGet('/v1/admin/fan-visitors?anon_id='+id+'&period=24h','SCOPED_TEST_KEY');
assert.equal(response.status,200);
result=await response.json();
assert.equal(result.events.length,2);
assert.equal(result.events[1].track_title,'PEACE!');
for(const row of result.events){
 assert.equal('user_agent' in row,false);
 assert.equal('ip_hash' in row,false);
 assert.equal('metadata_json' in row,false);
}
response=await vaultGet('/v1/admin/fan-visitors?anon_id=bad&period=24h','SCOPED_TEST_KEY');
assert.equal(response.status,400);
response=await vaultGet('/v1/admin/fan-visitors?period=bad','SCOPED_TEST_KEY');
assert.equal(response.status,400);
response=await vaultGet('/v1/admin/export','SCOPED_TEST_KEY');
assert.equal(response.status,401,'scoped credential cannot export data');
response=await vaultGet('/v1/admin/fan-detail?anon_id='+id,'SCOPED_TEST_KEY');
assert.equal(response.status,401,'scoped credential cannot read full private fan detail');
const penv={BACKROOM_PASSWORD:'OWNER_TEST',SESSION_SECRET:'TEST_SESSION',
 VAULT_ACCESS_CODES_TOKEN:'SCOPED_TEST_KEY',GITHUB_TOKEN:'TEST_GITHUB',
 GE_VAULT:{fetch:req=>{
  const pathname=new URL(req.url).pathname;
  if(pathname==='/health')return Promise.resolve(Response.json({ok:true,storage:'READY',access_codes_ready:true}));
  return vault.fetch(req,venv);
 }}};
const base='https://ge-backroom-publisher.grandelement.workers.dev';
const signed=(path,token='')=>new Request(base+path,{headers:{
 Origin:origin,...(token?{Authorization:'Bearer '+token}:{})
}});
response=await publisher.fetch(signed('/manage/fan-visitors'+query),penv);
assert.equal(response.status,401,'Publisher requires signed owner session');
response=await publisher.fetch(new Request(base+'/login',{method:'POST',headers:{
 Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:'OWNER_TEST'})}),penv);
assert.equal(response.status,200);
const token=(await response.json()).token;
response=await publisher.fetch(signed('/manage/fan-visitors'+query,token),penv);
assert.equal(response.status,200);
result=await response.json();
assert.equal(result.visitors[0].anon_id,id);
response=await publisher.fetch(signed('/manage/fan-visitors?anon_id='+id+'&period=24h',token),penv);
assert.equal(response.status,200);
result=await response.json();
assert.equal(result.events[0].page_path,'/music');
response=await publisher.fetch(new Request(base+'/manage/fan-visitors',{method:'POST',headers:{
 Origin:origin,Authorization:'Bearer '+token}}),penv);
assert.equal(response.status,404,'visitor drilldown is read only');
assert.equal(writes,0,'no D1 data writes from browsing visitor activity');
assert.ok(seen.some(sql=>sql.includes('GROUP BY e.anon_id')));
console.log('PASS: region visitor drilldown, per-visitor timeline, signed owner, safe fields, strict scope, no fan write');
