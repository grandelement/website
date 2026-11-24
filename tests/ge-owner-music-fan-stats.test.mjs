import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {Script} from 'node:vm';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const file=path=>readFile(new URL(path,import.meta.url),'utf8');
const [html,css,musicUi,fanUi,fanVisitorUi,vaultSource,publisherSource]=await Promise.all([
 file('../backroom/index.html'),file('../backroom/owner-unified-ui.css'),
 file('../backroom/music-section-nav.js'),file('../backroom/fan-statistics-tabs.js'),
 file('../backroom/fan-visitor-drilldown.js'),file('../vault-worker/src/index.js'),
 file('../backroom/publisher-worker.js')
]);
for(const [name,source] of [['Music section nav',musicUi],['Fan stats tabs',fanUi],['Visitor drilldown',fanVisitorUi],['Vault',vaultSource],['Publisher',publisherSource]])
 new Script(source.replace(/export default\s*\{/,'({'),{filename:name});
assert.match(html,/id="brMusicSections"[^>]*role="tablist"/);
assert.match(html,/id="brRouteSongSection"[^>]*data-br-music-section-panel="songs"/);
assert.match(html,/id="brRoutePlaylistSection"[^>]*data-br-music-section-panel="playlists"/);
assert.match(html,/id="brRouteAlbumTabs"/);
assert.match(musicUi,/function populateAlbums\(/);
assert.match(musicUi,/select\.dispatchEvent\(new Event\('change'/);
assert.match(musicUi,/panel\.hidden=mode!==next/);
assert.match(html,/id="brGeoPage"/);
assert.match(html,/fan-statistics-tabs\.js/);
assert.match(html,/music-section-nav\.js/);
assert.match(css,/#brPanel-access details\.brAccessCategory>summary::before/);
assert.match(css,/#brGeoPanel \.brGeoStates\{max-height:none!important;overflow:visible!important\}/);
assert.match(css,/#brGeoVisitorEvents\{max-height:none!important;overflow:visible!important\}/);
assert.match(fanUi,/\['pages','PAGES'\]/);
assert.match(fanUi,/\['activity','ACTIVITY'\]/);
assert.match(fanUi,/\['songs','SONGS'\]/);
assert.match(fanUi,/\['sources','SOURCES'\]/);
assert.match(fanUi,/Referrer|REFERRER/);
assert.match(fanVisitorUi,/window\.GE_BACKROOM_CLOSE_VISITOR_DRILLDOWN=hideDrilldown/);
assert.match(fanVisitorUi,/page:\$\('brGeoPage'\)\?\.value\|\|'ALL'/);

const vault=(await import('data:text/javascript;base64,'+Buffer.from(vaultSource).toString('base64'))).default;
const publisher=(await import('data:text/javascript;base64,'+Buffer.from(publisherSource).toString('base64'))).default;
const SQL=[];let writes=0;
const db={prepare(sql){
 SQL.push(sql);
 const stmt={args:[],bind(...args){this.args=args;return this;},
 async first(){return {events:32,visitors:5,sessions:5,last_seen:1795500000};},
 async all(){
  if(sql.includes('GROUP BY country,region'))return {results:[{state:'Alabama',country:'US',events:32,visitors:5,sessions:5}]};
  if(sql.includes('GROUP BY event_type'))return {results:[{event_type:'page_view',events:15,visitors:5}]};
  if(sql.includes('GROUP BY page_path'))return {results:[{page:'/radio/',events:20,visitors:5},{page:'/music/',events:12,visitors:3}]};
  if(sql.includes('GROUP BY surface'))return {results:[{surface:'radio',events:20,visitors:5}]};
  if(sql.includes('GROUP BY track_title'))return {results:[{song:'Peace',events:8,visitors:3}]};
  if(sql.includes('GROUP BY utm_source'))return {results:[{source:'newsletter',events:7}]};
  if(sql.includes('GROUP BY referrer'))return {results:[
   {referrer:'https://example.org/visitors/secret?token=sensitive',events:4},
   {referrer:'https://example.org/public?ref=secret2',events:2},
   {referrer:'https://search.example.net/?q=secret',events:3}]};
  if(sql.includes('GROUP BY e.anon_id'))return {results:[
   {anon_id:'visitor-abcdefghijklmnop',last_activity:1795500000,events:20,sessions:5,fan_id:null,fan_name:null,country:'US',region:'Alabama'}]};
  return {results:[]};
 },async run(){writes++;return {success:true}}};
 return stmt;
}};
const venv={VAULT_DB:db,VAULT_ACCESS_CODES_TOKEN:'SCOPED_TEST_KEY',VAULT_ADMIN_TOKEN:'ADMIN_TEST_KEY',
 VAULT_HASH_KEY:'HASH_TEST'};
const origin='https://grandelement.com';
const url='https://vault.grandelement.com/v1/admin/fan-geography?period=7d&country=US&page=%2Fradio%2F';
let response=await vault.fetch(new Request(url),venv);
assert.equal(response.status,401,'no public Fan analytics');
response=await vault.fetch(new Request(url,{headers:{Authorization:'Bearer SCOPED_TEST_KEY',Origin:origin}}),venv);
assert.equal(response.status,200);
const data=await response.json();
assert.equal(data.pages[0].page,'/radio/');
assert.equal(data.pages[0].events,20);
assert.equal(data.event_types[0].event_type,'page_view');
assert.equal(data.surfaces[0].surface,'radio');
assert.equal(data.songs[0].song,'Peace');
assert.equal(data.campaign_sources[0].source,'newsletter');
assert.equal(data.referrer_hosts[0].host,'example.org');
assert.equal(data.referrer_hosts[0].events,6);
assert.equal(data.referrer_hosts[1].host,'search.example.net');
assert.ok(!JSON.stringify(data.referrer_hosts).includes('secret'),'referrer paths and queries cannot be disclosed');
assert.ok(SQL.some(q=>q.includes('page_path=?')),'GE page uses bound exact-match filter');
assert.ok(SQL.some(q=>q.includes('GROUP BY page_path')),'page counts come from D1, not invented');
const penv={BACKROOM_PASSWORD:'OWNER_PASS',SESSION_SECRET:'TEST_SESSION',
 VAULT_ACCESS_CODES_TOKEN:'SCOPED_TEST_KEY',GITHUB_TOKEN:'GH_TEST',
 GE_VAULT:{fetch(req){
  if(new URL(req.url).pathname==='/health')return Promise.resolve(Response.json({ok:true,storage:'READY',access_codes_ready:true}));
  return vault.fetch(req,venv);
 }}};
const base='https://ge-backroom-publisher.grandelement.workers.dev';
response=await publisher.fetch(new Request(base+'/manage/fan-geography?period=7d&country=US&page=%2Fradio%2F'),penv);
assert.equal(response.status,401,'Back Room sign-in required');
response=await publisher.fetch(new Request(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:'OWNER_PASS'})}),penv);
assert.equal(response.status,200);
const token=(await response.json()).token;
response=await publisher.fetch(new Request(base+'/manage/fan-geography?period=7d&country=US&page=%2Fradio%2F',{
 headers:{Origin:origin,Authorization:'Bearer '+token}
}),penv);
assert.equal(response.status,200);
const result=await response.json();
assert.equal(result.page,'/radio/');
response=await publisher.fetch(new Request(base+'/manage/fan-visitors?period=7d&page=%2Fradio%2F',{headers:{Authorization:'Bearer '+token,Origin:origin}}),penv);
assert.equal(response.status,200);
assert.ok(SQL.some(q=>q.includes('e.page_path=?')),'visitor list honors selected GE page filter');
assert.equal(writes,0,'no DB mutation in statistics reads');
console.log('PASS: Music tabs, album jumps, Access expandability, compact type, fan page/activity/song/referrer summaries, owner-only page filtering, zero writes');
