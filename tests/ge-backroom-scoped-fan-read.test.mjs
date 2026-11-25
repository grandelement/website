import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const file=async path=>readFile(new URL(path,import.meta.url),'utf8');
const importWorker=async source=>(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const vaultSource=await file('../vault-worker/src/index.js');
const publisherSource=await file('../backroom/publisher-worker.js');
const ui=await file('../backroom/index.html');
assert.match(ui,/>CHECK VAULT CONNECTIONS<\/button>/);
assert.match(ui,/\['Private scoped bridge',c\.scoped_bridge_configured\]/);
const vault=await importWorker(vaultSource);
const publisher=await importWorker(publisherSource);
let sqlWrites=0;
const db={prepare(sql){
 return {bind(...args){this.args=args;return this;},
  async first(){return {events:3,visitors:2,sessions:2,last_seen:1750000000};},
  async all(){
   if(sql.includes('FROM fan_music_playlists p'))return {results:[{id:'fanmix1',owner_hash:'12'.repeat(32),anon_id:'visitor1',name:'Favorite Songs',songs_json:'["song1"]',created_at:1750000000,updated_at:1750000000,fan_id:null,fan_name:null,code_id:null,code_label:null}]};
   if(sql.includes('GROUP BY country,region'))return {results:[{state:'Colorado',country:'US',events:3,visitors:2,sessions:2}]};
   if(sql.includes('GROUP BY event_type'))return {results:[{event_type:'page_view',events:3,visitors:2}]};
   if(sql.includes('FROM fan_events WHERE occurred_at>='))return {results:[{anon_id:'visitor1',last_activity:1750000000,fan_id:null}]};
   return {results:[]};
  },async run(){sqlWrites++;return {success:true}}};
}};
const venv={VAULT_ACCESS_CODES_TOKEN:'SCOPED_TEST_ONLY',VAULT_ADMIN_TOKEN:'ADMIN_TEST_ONLY',
 VAULT_HASH_KEY:'test-hash-key',VAULT_DB:db};
const origin='https://grandelement.com';
async function vcall(path,token='',method='GET'){
 return vault.fetch(new Request('https://vault.grandelement.com'+path,{
 method,headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{})}
 }),venv);
}
let response=await vcall('/v1/admin/fan-geography?period=24h&country=ALL');
assert.equal(response.status,401,'anonymous geography must not be public');
response=await vcall('/v1/admin/fan-geography?period=24h&country=ALL','SCOPED_TEST_ONLY');
assert.equal(response.status,200,'existing scoped token can read only fan geography');
let data=await response.json();
assert.equal(data.totals.events,3);
response=await vcall('/v1/admin/fan-playlists','SCOPED_TEST_ONLY');
assert.equal(response.status,200,'existing scoped token can list private fan playlists');
data=await response.json();
assert.equal(data.items.length,1);
response=await vcall('/v1/admin/export','SCOPED_TEST_ONLY');
assert.equal(response.status,401,'scoped token must never allow exports');
response=await vcall('/v1/admin/fan-detail?anon_id=visitor1','SCOPED_TEST_ONLY');
assert.equal(response.status,401,'scoped token must never allow private fan detail');
response=await vcall('/v1/admin/analytics?period=24h','SCOPED_TEST_ONLY');
assert.equal(response.status,401,'scoped token must never allow broader analytics');
response=await vcall('/v1/admin/fan-playlists','SCOPED_TEST_ONLY','POST');
assert.equal(response.status,404,'scoped playlist listing must never grant playlist mutation');

const base='https://ge-backroom-publisher.grandelement.workers.dev';
let bridged=0;
const penv={BACKROOM_PASSWORD:'BACKROOM_TEST',SESSION_SECRET:'BACKROOM_SECRET',
 GITHUB_TOKEN:'GITHUB_MOCK',VAULT_ACCESS_CODES_TOKEN:'SCOPED_TEST_ONLY',
 GE_VAULT:{async fetch(req){bridged++;
  const u=new URL(typeof req==='string'?req:req.url);
  if(u.pathname==='/health')return Response.json({ok:true,storage:'READY',access_codes_ready:true});
  if(u.pathname==='/v1/admin/access-codes')return Response.json({ok:true,items:[]});
  return vault.fetch(req,venv);
 }}};
const req=(path,auth='')=>new Request(base+path,{
 headers:{Origin:origin,...(auth?{Authorization:'Bearer '+auth}:{})}
});
response=await publisher.fetch(req('/manage/fan-geography?period=24h&country=ALL'),penv);
assert.equal(response.status,401,'publisher must not expose private geography to anonymous website visitors');
response=await publisher.fetch(new Request(base+'/login',{method:'POST',
 headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify({password:'BACKROOM_TEST'})}),penv);
assert.equal(response.status,200);
const session=(await response.json()).token;
assert.ok(session);
response=await publisher.fetch(req('/manage/fan-geography?period=24h&country=ALL',session),penv);
assert.equal(response.status,200,'publisher fan geography must read through scoped bridge');
response=await publisher.fetch(req('/manage/fan-playlists',session),penv);
assert.equal(response.status,200,'publisher private fan playlists must read through scoped bridge');
response=await publisher.fetch(req('/manage/vault-reconnect',session),penv);
assert.equal(response.status,200);
data=await response.json();
assert.equal(data.checks.admin_token_configured,false,'mock publisher does not have full admin secret');
assert.equal(data.checks.scoped_bridge_configured,true);
assert.equal(data.checks.fan_analytics_readable,true);
assert.equal(data.checks.fan_playlists_readable,true);
assert.equal(data.checks.access_codes_readable,true);
assert.equal(data.ok,true,'full fan read-only checks must succeed with existing scoped bridge');
response=await publisher.fetch(req('/manage/fan-access?period=7d',session),penv);
assert.equal(response.status,200,'owner recent visitors can use 7d lookback');
data=await response.json();
assert.equal(data.recent_window_seconds,604800);
response=await publisher.fetch(req('/manage/fan-access?period=bad',session),penv);
assert.equal(response.status,400,'reject arbitrary lookback queries');
assert.ok(bridged>=4);
console.log('PASS: scoped Vault reads, real Publisher owner flow, exact route scope, no private export, no secret rotation;',sqlWrites,'idempotent schema checks');
