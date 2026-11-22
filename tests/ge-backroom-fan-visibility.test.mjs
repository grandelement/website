import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const publisher=await readFile(new URL('../backroom/publisher-worker.js',import.meta.url),'utf8');
const vault=await readFile(new URL('../vault-worker/src/index.js',import.meta.url),'utf8');
const html=await readFile(new URL('../backroom/index.html',import.meta.url),'utf8');
assert.ok(vault.includes('recentWindowSeconds=({"1h":3600,"24h":86400,"7d":604800})[period]||86400'),
 'Vault recent events must offer a truthful, selectable lookback period');
assert.ok(vault.includes('.bind(now()-recentWindowSeconds).all()'),
 'Vault query must actually use the selected lookback window');
assert.ok(html.includes('SAVED FAN PLAYLISTS · PRIVATE')&&html.includes("fanPanel.appendChild(fanPlaylistsDrawer)"),
 'Private playlists must live under Fan Profiles, not a separate top-level panel');
assert.ok(html.includes('id=\'brRecentPeriod\''), 'Recent visitor period must be selectable');
assert.ok(html.includes('No recorded visitor events in this period. This is not proof of zero visits.'),
 'Never misrepresent an empty recorded-events response as zero website visits');
assert.ok(html.includes('>CHECK VAULT CONNECTIONS</button>'),
 'Read-only diagnostic must not promise automatic reconnection');

const worker=(await import('data:text/javascript;base64,'+Buffer.from(publisher).toString('base64'))).default;
let paths=[];
const scoped='TEST_SCOPED_FAN_DIRECTORY';
const env={
 BACKROOM_PASSWORD:'TEST_OWNER',SESSION_SECRET:'TEST_SESSION_SECRET',
 GITHUB_TOKEN:'TEST_GITHUB',VAULT_ACCESS_CODES_TOKEN:scoped,
 GE_VAULT:{async fetch(req){
  const url=new URL(typeof req==='string'?req:req.url);
  paths.push(url.pathname+url.search);
  if(url.pathname==='/health')return Response.json({ok:true,storage:'READY',access_codes_ready:true});
  assert.equal(req.headers.get('Authorization'),'Bearer '+scoped);
  if(url.pathname==='/v1/admin/access-codes')return Response.json({ok:true,items:[]});
  if(url.pathname==='/v1/admin/fan-access')return Response.json({
   ok:true,fans:[],recent:[],recent_window_seconds:url.searchParams.get('period')==='7d'?604800:86400
  });
  throw Error('Unexpected private Vault route: '+url.pathname);
 }}
};
const base='https://ge-backroom-publisher.grandelement.workers.dev';
const req=(path,headers={})=>new Request(base+path,{
 headers:{Origin:'https://grandelement.com',...headers}
});
const login=await worker.fetch(new Request(base+'/login',{
 method:'POST',headers:{Origin:'https://grandelement.com','Content-Type':'application/json'},
 body:JSON.stringify({password:'TEST_OWNER'})
}),env);
assert.equal(login.status,200);
const token=(await login.json()).token;
assert.ok(token);
const auth={Authorization:'Bearer '+token};

const anonymous=await worker.fetch(req('/manage/fan-access?period=7d'),env);
assert.equal(anonymous.status,401,'fan records must require Back Room owner login');
const recent=await worker.fetch(req('/manage/fan-access?period=7d',auth),env);
assert.equal(recent.status,200);
const body=await recent.json();
assert.equal(body.recent_window_seconds,604800);
assert.ok(paths.includes('/v1/admin/fan-access?period=7d'),
 'GET lookback parameter must be passed through the scoped, authenticated bridge');
const invalid=await worker.fetch(req('/manage/fan-access?period=never',auth),env);
assert.equal(invalid.status,400,'period must be allowlisted');
const diagnostic=await worker.fetch(req('/manage/vault-reconnect',auth),env);
assert.equal(diagnostic.status,200);
const data=await diagnostic.json();
assert.equal(data.checks.admin_token_configured,false,'the full admin token is missing');
assert.equal(data.checks.access_codes_readable,true,'a scoped token must still verify Access Codes');
assert.equal(data.checks.fan_analytics_readable,false,'analytics cannot be marked verified without admin authorization');
assert.equal(data.ok,false,'partial connectivity must not be described as a full Vault connection');
const analytics=await worker.fetch(req('/manage/fan-geography',auth),env);
assert.equal(analytics.status,503,'scoped credential must never unlock private analytics');
const playlists=await worker.fetch(req('/manage/fan-playlists',auth),env);
assert.equal(playlists.status,503,'scoped credential must never unlock private fan playlists');
console.log('PASS: fan recent window, nested playlist UI, scoped Access Codes diagnostic, and private analytics security');
