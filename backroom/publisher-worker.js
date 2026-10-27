/**
 * GE Studios Website Back Room Publisher
 * Cloudflare Worker
 *
 * Secrets required in Cloudflare:
 *   BACKROOM_PASSWORD   admin password (never commit it)
 *   SESSION_SECRET      long random signing secret
 *   GitHub App preferred: GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY
 *   GITHUB_TOKEN        optional legacy fallback during migration
 *
 * Optional vars:
 *   GITHUB_OWNER        default: grandelement
 *   GITHUB_REPO         default: website
 *   GITHUB_BRANCH       default: main
 */

const enc=new TextEncoder();
const dec=new TextDecoder();

function json(data,status=200,origin=''){
  const headers={
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  };
  if(origin){
    headers['Access-Control-Allow-Origin']=origin;
    headers['Vary']='Origin';
    headers['Access-Control-Allow-Headers']='Content-Type, Authorization';
    headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
    headers['Access-Control-Max-Age']='600';
  }
  return new Response(JSON.stringify(data),{status,headers});
}

function allowedOrigin(origin){
  return new Set([
    'https://grandelement.com',
    'https://www.grandelement.com',
    'https://grandelement.github.io'
  ]).has(origin);
}

function b64url(bytes){
  let s='';
  for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(text){
  let s=String(text||'').replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4)s+='=';
  const raw=atob(s),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
function utf8B64(text){
  const bytes=enc.encode(text);let binary='';
  for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary);
}
async function sha256(text){return new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(text||''))))}
function sameBytes(a,b){
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}
async function hmac(secret,text){
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(text)));
}
async function makeSession(env){
  const payload=b64url(enc.encode(JSON.stringify({sub:'ge-backroom',iat:Date.now(),exp:Date.now()+12*60*60*1000,nonce:crypto.randomUUID()})));
  const sig=b64url(await hmac(env.SESSION_SECRET,payload));
  return payload+'.'+sig;
}
async function verifySession(env,token){
  try{
    const [payload,sig]=String(token||'').split('.');
    if(!payload||!sig)return false;
    const expected=await hmac(env.SESSION_SECRET,payload);
    if(!sameBytes(expected,fromB64url(sig)))return false;
    const body=JSON.parse(dec.decode(fromB64url(payload)));
    return body?.sub==='ge-backroom'&&Number(body.exp)>Date.now();
  }catch(_e){return false}
}
function bearer(request){
  const m=String(request.headers.get('Authorization')||'').match(/^Bearer\s+(.+)$/i);
  return m?m[1]:'';
}
function validConfig(cfg){
  if(!cfg||typeof cfg!=='object'||Array.isArray(cfg))return false;
  if(!cfg.welcome||typeof cfg.welcome!=='object')return false;
  if(!cfg.albums||typeof cfg.albums!=='object')return false;
  if(!cfg.games||typeof cfg.games!=='object')return false;
  return true;
}
// GitHub App credentials stay exclusively in Cloudflare Worker secrets.
// Installation access tokens expire automatically; the Worker requests fresh ones.
let appTokenCache=null;
async function githubAppJwt(env){
  const appId=String(env.GITHUB_APP_ID||'').trim();
  const pem=String(env.GITHUB_APP_PRIVATE_KEY||'').replace(/\\n/g,'\n').trim();
  if(!appId||!pem)throw new Error('GitHub App credentials are incomplete.');
  const body=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  const bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const now=Math.floor(Date.now()/1000);
  const header=b64url(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload=b64url(enc.encode(JSON.stringify({iat:now-60,exp:now+540,iss:appId})));
  const unsigned=header+'.'+payload;
  return unsigned+'.'+b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(unsigned)));
}
async function githubCredential(env){
  const hasApp=!!(env.GITHUB_APP_ID&&env.GITHUB_APP_INSTALLATION_ID&&env.GITHUB_APP_PRIVATE_KEY);
  if(!hasApp){
    if(env.GITHUB_TOKEN)return String(env.GITHUB_TOKEN);
    throw new Error('GitHub publishing credentials are not configured.');
  }
  const identity=String(env.GITHUB_APP_ID)+':'+String(env.GITHUB_APP_INSTALLATION_ID);
  if(appTokenCache&&appTokenCache.identity===identity&&appTokenCache.expires>Date.now()+120000){
    return appTokenCache.token;
  }
  const jwt=await githubAppJwt(env);
  const response=await fetch('https://api.github.com/app/installations/'+encodeURIComponent(String(env.GITHUB_APP_INSTALLATION_ID))+'/access_tokens',{
    method:'POST',
    headers:{
      'Accept':'application/vnd.github+json',
      'Authorization':'Bearer '+jwt,
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'GE-Studios-Backroom-Publisher'
    },
    body:JSON.stringify({repositories:[env.GITHUB_REPO||'website'],permissions:{contents:'write'}})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.token)throw new Error('GitHub App authorization failed ('+response.status+'). Check App installation and Contents permission.');
  appTokenCache={identity,token:data.token,expires:Date.parse(data.expires_at)||Date.now()+50*60*1000};
  return data.token;
}
async function github(env,path,init={}){
  const owner=env.GITHUB_OWNER||'grandelement';
  const repo=env.GITHUB_REPO||'website';
  const credential=await githubCredential(env);
  return fetch('https://api.github.com/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path,{
    ...init,
    headers:{
      'Accept':'application/vnd.github+json',
      'Authorization':'Bearer '+credential,
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'GE-Studios-Backroom-Publisher',
      ...(init.headers||{})
    }
  });
}
async function publishLive(env,cfg){
  const branch=env.GITHUB_BRANCH||'main';
  const path='config/site-live.json';
  const current=await github(env,path+'?ref='+encodeURIComponent(branch),{method:'GET'});
  if(!current.ok)throw new Error('Could not read live configuration from GitHub.');
  const currentData=await current.json();
  const out=structuredClone(cfg);
  out.version=Math.max(1,Number(out.version)||1);
  out.mode='live';
  out.publishedAt=new Date().toISOString();
  const content=JSON.stringify(out,null,2)+'\n';
  if(content.length>250000)throw new Error('Configuration is too large.');
  const update=await github(env,path,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      message:'Publish live website configuration from Back Room',
      content:utf8B64(content),
      sha:currentData.sha,
      branch
    })
  });
  const result=await update.json().catch(()=>({}));
  if(!update.ok)throw new Error(result?.message||'GitHub rejected the publish.');
  return {commit:result?.commit?.sha||'',contentSha:result?.content?.sha||'',config:out};
}


function decodeGithubText(content){
  const raw=atob(String(content||'').replace(/\s/g,''));
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return dec.decode(bytes);
}
async function readPresetStore(env){
  const branch=env.GITHUB_BRANCH||'main';
  const path='config/backroom-presets.json';
  const current=await github(env,path+'?ref='+encodeURIComponent(branch),{method:'GET'});
  if(current.status===404)return {store:{version:1,presets:[]},sha:''};
  if(!current.ok)throw new Error('Could not read saved Back Room presets from GitHub.');
  const data=await current.json();
  let store={version:1,presets:[]};
  try{store=JSON.parse(decodeGithubText(data.content||''))}catch(_e){}
  if(!store||typeof store!=='object')store={version:1,presets:[]};
  if(!Array.isArray(store.presets))store.presets=[];
  return {store,sha:data.sha||''};
}
async function writePresetStore(env,store,sha=''){
  const branch=env.GITHUB_BRANCH||'main';
  const path='config/backroom-presets.json';
  const content=JSON.stringify(store,null,2)+'\n';
  if(content.length>1000000)throw new Error('Saved presets are too large.');
  const body={
    message:'Save Back Room website preset',
    content:utf8B64(content),
    branch
  };
  if(sha)body.sha=sha;
  const update=await github(env,path,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const result=await update.json().catch(()=>({}));
  if(!update.ok)throw new Error(result?.message||'GitHub rejected the preset save.');
  return result?.commit?.sha||'';
}
async function savePreset(env,preset){
  if(!preset||typeof preset!=='object'||!validConfig(preset.config))throw new Error('Preset configuration is incomplete.');
  const name=String(preset.name||'').trim().slice(0,60);
  if(!name)throw new Error('Give this preset a name.');
  const {store,sha}=await readPresetStore(env);
  const now=new Date().toISOString();
  const existing=(store.presets||[]).find(p=>String(p.name||'').toLowerCase()===name.toLowerCase());
  const item={
    id:existing?.id||crypto.randomUUID(),
    name,
    updatedAt:now,
    config:structuredClone(preset.config),
    soulNames:Array.isArray(preset.soulNames)?preset.soulNames.map(x=>String(x||'').slice(0,18)).slice(0,6):[]
  };
  store.version=1;
  store.presets=(store.presets||[]).filter(p=>p.id!==item.id);
  store.presets.unshift(item);
  store.presets=store.presets.slice(0,50);
  const commit=await writePresetStore(env,store,sha);
  return {preset:item,presets:store.presets,commit};
}
async function deletePreset(env,id){
  const {store,sha}=await readPresetStore(env);
  const before=store.presets.length;
  store.presets=store.presets.filter(p=>p.id!==id);
  if(store.presets.length===before)throw new Error('Saved preset was not found.');
  const commit=await writePresetStore(env,store,sha);
  return {presets:store.presets,commit};
}


/* Owner-only GE Vault bridge. The Vault admin token never reaches the browser.
   No code/playlist record is written to public GitHub or site-live.json. */
async function geVaultBridge(env,path,method='GET',body=null){
  // Access Codes have a dedicated least-privilege bridge secret. Legacy
  // admin fallback exists for publishers that were configured previously.
  // GitHub remains the exclusive GE playlist master.
  const accessPath=path==='/v1/admin/access-codes';
  const secret=String((accessPath&&env.VAULT_ACCESS_CODES_TOKEN)||env.VAULT_ADMIN_TOKEN||'').trim();
  if(!secret)return {status:503,data:{ok:false,error:accessPath?
    'Access Codes bridge is not configured on the Back Room publisher. Deploy/configure VAULT_ACCESS_CODES_TOKEN on both Workers.':
    'GE Vault connection is not configured on the Back Room publisher.'}};
  const url='https://vault.grandelement.com'+path;
  const init={method,headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json','Accept':'application/json'},redirect:'manual'};
  if(body!==null)init.body=JSON.stringify(body);
  try{
    // Production uses the Wrangler service binding. This bypasses the public
    // Cloudflare edge and calls the SAME Vault Worker (same D1 database) directly.
    // The public URL remains only a development/test fallback when not bound.
    const response=env.GE_VAULT?.fetch
      ?await env.GE_VAULT.fetch(new Request(url,init))
      :await fetch(url,init);
    const data=await response.json().catch(()=>({ok:false,error:'GE Vault returned a non-JSON response (HTTP '+response.status+').'}));
    return{status:response.status,data};
  }catch(error){
    // Log only the failure class, never secret headers or access-code values.
    console.error('GE Vault bridge failure',String(error?.name||'Error'));
    return {status:502,data:{ok:false,error:env.GE_VAULT?.fetch?
      'Private GE Vault service binding failed. Check Vault Worker health and binding deployment.':
      'GE Vault could not be reached. Private GE_VAULT binding is missing on the Back Room Worker.'}};
  }
}


// GitHub-only published/unlisted playlist registry. This path does not call
// GE Vault, D1 or any Cloudflare data store. Authentication is the existing
// short-lived Back Room session; permanent writes are GitHub commits.
const GITHUB_PLAYLISTS_PATH='playlists/registry.json';
function playlistSongPath(p){
  return typeof p==='string'&&p.length<=600&&/^ge-music\/music\/.+\.(?:mp3|m4a|wav|ogg|flac)$/i.test(p)&&
    !p.includes('..')&&!p.includes('\\')&&!p.includes('?')&&!p.includes('#');
}
async function readGithubPlaylistRegistry(env){
  const branch=env.GITHUB_BRANCH||'main';
  const response=await github(env,GITHUB_PLAYLISTS_PATH+'?ref='+encodeURIComponent(branch),{method:'GET'});
  if(!response.ok)throw Error('GitHub playlist file could not be read (HTTP '+response.status+'). Nothing was changed.');
  const file=await response.json();
  let data;
  try{data=JSON.parse(decodeGithubText(file.content||''))}catch(_e){throw Error('GitHub playlist registry is invalid JSON. No records were changed.')}
  if(data?.format!=='ge-playlist-registry-v1'||!Array.isArray(data.playlists))
    throw Error('GitHub playlist registry has an unexpected format. No records were changed.');
  return {registry:data,sha:String(file.sha||'')};
}
function githubPlaylistToEditor(row){
  const songs=Array.isArray(row.songs)?row.songs:[];
  return {id:row.id,name:row.name,active:false,locked:false,metadata_json:JSON.stringify({
    source:'ge-github',public:row.visibility==='published',visibility:row.visibility||'unlisted'
  }),tracks:songs.map((track_path,position)=>({track_path,position}))};
}
async function saveGithubPlaylistRegistry(env,registry,sha){
  const branch=env.GITHUB_BRANCH||'main';
  const content=JSON.stringify(registry,null,2)+'\n';
  if(content.length>1100000)throw Error('GitHub playlist registry is too large for safe update.');
  const response=await github(env,GITHUB_PLAYLISTS_PATH,{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      message:'Update GE shared playlists from Back Room',
      branch,sha,content:utf8B64(content)
    })
  });
  const saved=await response.json().catch(()=>({}));
  if(!response.ok){
    if(response.status===409||response.status===422)
      throw Error('GitHub playlist changed while you were editing. Refresh and review before saving again.');
    throw Error('GitHub refused playlist save (HTTP '+response.status+'): '+String(saved.message||'Unknown error').slice(0,180));
  }
  return String(saved.commit?.sha||'');
}
async function handleGithubPlaylists(request,env,cors){
  if(!(await verifySession(env,bearer(request))))
    return json({ok:false,error:'Owner login required. Sign in to Back Room.'},401,cors);
  try{
    const {registry,sha}=await readGithubPlaylistRegistry(env);
    if(request.method==='GET'){
      return json({ok:true,storage:'GITHUB',items:registry.playlists.map(githubPlaylistToEditor),commit_sha:sha},200,cors);
    }
    if(request.method!=='POST')return json({ok:false,error:'Only GET and POST are supported.'},405,cors);
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=='object')return json({ok:false,error:'Invalid playlist request.'},400,cors);
    const action=String(body.action||'');
    if(action==='save'){
      const proposed=body.playlist||{},name=String(proposed.name||'').trim();
      const id=String(proposed.id||'').trim()||'playlist_'+crypto.randomUUID().replace(/-/g,'');
      const tracks=Array.isArray(proposed.tracks)?proposed.tracks:[];
      if(!name||name.length>100)return json({ok:false,error:'Playlist name is required (up to 100 characters).'},400,cors);
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))return json({ok:false,error:'Invalid playlist ID.'},400,cors);
      if(tracks.length<1||tracks.length>500)return json({ok:false,error:'Select 1–500 songs.'},400,cors);
      const songs=tracks.map(t=>String(t?.track_path||''));
      if(songs.some(p=>!playlistSongPath(p)))return json({ok:false,error:'Playlist contains an invalid GE Music path.'},400,cors);
      if(new Set(songs).size!==songs.length)return json({ok:false,error:'Remove duplicate songs from the playlist.'},400,cors);
      if(registry.playlists.some(p=>p.id!==id&&String(p.name||'').trim().toLowerCase()===name.toLowerCase()))
        return json({ok:false,error:'That playlist name already exists; select it to edit.'},409,cors);
      if(proposed.id&&!registry.playlists.some(p=>p.id===id))
        return json({ok:false,error:'This playlist was removed or renamed elsewhere; refresh before saving.'},409,cors);
      const prior=registry.playlists.find(p=>p.id===id);
      const next={
        id,name,visibility:proposed.public?'published':'unlisted',
        songs,updated_at:new Date().toISOString()
      };
      if(prior?.created_at)next.created_at=prior.created_at;
      else next.created_at=next.updated_at;
      // Never change the live BLITZ queue; this registry is a separate collection.
      registry.playlists=registry.playlists.filter(p=>p.id!==id);
      registry.playlists.push(next);
      const commit=await saveGithubPlaylistRegistry(env,registry,sha);
      return json({ok:true,id,name,commit_sha:commit,storage:'GITHUB'},200,cors);
    }
    if(action==='delete'){
      const id=String(body.id||'');
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))return json({ok:false,error:'Invalid playlist ID.'},400,cors);
      if(!registry.playlists.some(p=>p.id===id))return json({ok:false,error:'Playlist was not found; refresh first.'},404,cors);
      // Never delete the authentic BLITZ Bangers source: it lives on the DJ backend.
      registry.playlists=registry.playlists.filter(p=>p.id!==id);
      const commit=await saveGithubPlaylistRegistry(env,registry,sha);
      return json({ok:true,id,commit_sha:commit,storage:'GITHUB'},200,cors);
    }
    return json({ok:false,error:'Unknown GitHub playlist action.'},400,cors);
  }catch(error){
    return json({ok:false,error:String(error?.message||error).slice(0,280)},502,cors);
  }
}

const GE_UPLOAD_LIMIT=60*1024*1024;
const GE_AUDIO_TYPES={mp3:"audio/mpeg",m4a:"audio/mp4",wav:"audio/wav",ogg:"audio/ogg"};
// Owner-only PRIVATE R2 upload. Never writes to public GitHub or changes Radio.
async function handleMusicUpload(request,env,url,cors){
  if(!(await verifySession(env,bearer(request))))
    return json({ok:false,error:"Sign in through the private GE Back Room first."},401,cors);
  if(!env.GE_AUDIO_UPLOADS)
    return json({ok:false,error:"GE audio storage is not bound. Create private R2 bucket ge-audio-uploads and bind it as GE_AUDIO_UPLOADS to the Back Room publisher."},503,cors);
  if(request.method==="GET"){
    const results=[];
    let cursor;
    do{
      const items=await env.GE_AUDIO_UPLOADS.list({prefix:"staged/",limit:250,...(cursor?{cursor}:{})});
      results.push(...items.objects.map(x=>({key:x.key,bytes:x.size,uploaded:x.uploaded?.toISOString?.()||"",album:x.customMetadata?.album||"",name:x.customMetadata?.name||"",title:x.customMetadata?.title||"",status:"PRIVATE · STAGED"})));
      cursor=items.truncated?items.cursor:null;
    }while(cursor&&results.length<1000);
    return json({ok:true,items:results,total:results.length,storage:"GE AUDIO · PRIVATE R2"},200,cors);
  }
  if(request.method!=="POST")return json({ok:false,error:"Upload only supports GET or POST."},405,cors);
  const album=String(url.searchParams.get("album")||"").trim();
  const name=String(url.searchParams.get("name")||"").trim();
  const title=String(url.searchParams.get("title")||"").trim();
  const declared=Number(url.searchParams.get("bytes"));
  const ext=name.split(".").pop().toLowerCase();
  if(!/^Grand Element - (?:[0-9]{4} - [a-zA-Z0-9][a-zA-Z0-9 _().&-]{0,80}|Singles)$/.test(album)||
     name.length>180||!name||name.includes("/")||name.includes("\\")||!Object.hasOwn(GE_AUDIO_TYPES,ext)||
     !title||title.length>180||!Number.isSafeInteger(declared)||declared<1||declared>GE_UPLOAD_LIMIT)
    return json({ok:false,error:"Enter a valid album and title, then choose one audio file (MP3, M4A, WAV, OGG; maximum 60 MB)."},400,cors);
  const length=Number(request.headers.get("Content-Length")||0);
  if(length&&length!==declared)
    return json({ok:false,error:"Upload size does not match the selected file."},400,cors);
  if(!request.body)return json({ok:false,error:"Empty upload. No file was saved."},400,cors);
  // Every upload has an immutable key. This deliberately cannot overwrite an existing master.
  const uid=crypto.randomUUID();
  const key="staged/"+uid+"/"+name.replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/^\.+/,"").slice(0,155);
  const mime=GE_AUDIO_TYPES[ext];
  const stored=await env.GE_AUDIO_UPLOADS.put(key,request.body,{
    httpMetadata:{contentType:mime},
    customMetadata:{album,name,title,origin:"ge-backroom-album-upload"},
  });
  if(!stored)return json({ok:false,error:"Cloud storage did not confirm the upload."},503,cors);
  if(stored.size!==declared){
    await env.GE_AUDIO_UPLOADS.delete(key);
    return json({ok:false,error:"Uploaded file length was incomplete; discarded the incomplete private copy."},422,cors);
  }
  const receipt={id:"music-"+uid,album_folder:album,track_title:title,original_filename:name,storage_key:key,media_type:mime,bytes:stored.size};
  const saved=await geVaultBridge(env,"/v1/admin/music-assets","POST",{asset:receipt});
  // Never delete a successfully uploaded original if Vault indexing is down.
  // The authenticated R2 listing retains the receipt for safe reconciliation.
  return json({ok:true,stored:true,private:true,storage_key:key,bytes:stored.size,
    vault_saved:saved.status===200&&saved.data?.ok===true,
    warning:saved.status===200&&saved.data?.ok===true?"":"Private audio saved; Vault catalog receipt is still pending. Do not re-upload.",
    asset_id:receipt.id},saved.status===200&&saved.data?.ok===true?200:202,cors);
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const origin=request.headers.get('Origin')||'';
    if(request.method==='OPTIONS'){
      if(!allowedOrigin(origin))return new Response(null,{status:403});
      return new Response(null,{status:204,headers:{
        'Access-Control-Allow-Origin':origin,'Vary':'Origin',
        'Access-Control-Allow-Headers':'Content-Type, Authorization',
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
        'Access-Control-Max-Age':'600'
      }});
    }
    if(origin&&!allowedOrigin(origin))return json({ok:false,error:'Origin not allowed.'},403,'');
    const cors=allowedOrigin(origin)?origin:'';
    const appReady=!!(env.GITHUB_APP_ID&&env.GITHUB_APP_INSTALLATION_ID&&env.GITHUB_APP_PRIVATE_KEY);
    const configured=!!(env.BACKROOM_PASSWORD&&env.SESSION_SECRET&&(appReady||env.GITHUB_TOKEN));

    if(url.pathname==='/health'&&request.method==='GET'){
      // Controlled live end-to-end diagnostic. No records, code names or secrets
      // ever leave the Publisher. This tests the ACTUAL authenticated list
      // handler rather than merely checking whether a Worker responds.
      if(url.searchParams.get('diagnose')==='access-codes'){
        const upstream=await geVaultBridge(env,'/v1/admin/access-codes');
        const readable=upstream.status===200&&upstream.data?.ok===true&&
          Array.isArray(upstream.data?.items);
        return json({
          ok:readable,access_codes_readable:readable,
          upstream_http_status:upstream.status,
          publisher_configured:configured,
          vault_service_bound:!!env.GE_VAULT?.fetch
        },readable?200:503,cors);
      }
      let vaultProbe={bound:!!env.GE_VAULT?.fetch,reachable:false,access_codes_ready:false};
      if(vaultProbe.bound){
        try{
          const health=await env.GE_VAULT.fetch(new Request('https://vault.grandelement.com/health'));
          const report=await health.json();
          vaultProbe.reachable=health.ok&&report?.ok===true;
          vaultProbe.access_codes_ready=vaultProbe.reachable&&report?.access_codes_ready===true;
        }catch(error){console.error('GE Vault health probe failed',String(error?.name||'Error'))}
      }
      return json({ok:true,configured,playlist_storage:'GITHUB',github_playlists_endpoint:true,
        access_codes_bridge_configured:!!(env.VAULT_ACCESS_CODES_TOKEN||env.VAULT_ADMIN_TOKEN),
        vault_service_bound:vaultProbe.bound,
        vault_reachable:vaultProbe.reachable,
        vault_access_codes_ready:vaultProbe.access_codes_ready},200,cors);
    }
    if(!configured)return json({ok:false,error:'Publisher secrets are not configured.'},503,cors);

    if(url.pathname==='/manage/music/uploads'&&['GET','POST'].includes(request.method)){
      try{return await handleMusicUpload(request,env,url,cors)}
      catch(error){return json({ok:false,error:"Private audio transfer failed: "+String(error?.message||error).slice(0,170)},503,cors)}
    }

    if(url.pathname==='/login'&&request.method==='POST'){
      let body={};try{body=await request.json()}catch(_e){}
      const a=await sha256(String(body.password||'')),b=await sha256(env.BACKROOM_PASSWORD);
      if(!sameBytes(a,b)){
        await new Promise(r=>setTimeout(r,650));
        return json({ok:false,error:'Incorrect password.'},401,cors);
      }
      return json({ok:true,token:await makeSession(env),expiresHours:12},200,cors);
    }

    if(url.pathname==='/session'&&request.method==='GET'){
      const ok=await verifySession(env,bearer(request));
      return json({ok},ok?200:401,cors);
    }

    if(url.pathname==='/presets'&&request.method==='GET'){
      if(!(await verifySession(env,bearer(request))))return json({ok:false,error:'Sign in again.'},401,cors);
      try{
        const {store}=await readPresetStore(env);
        return json({ok:true,presets:store.presets||[]},200,cors);
      }catch(error){
        return json({ok:false,error:String(error?.message||error)},502,cors);
      }
    }

    if(url.pathname==='/presets'&&request.method==='POST'){
      if(!(await verifySession(env,bearer(request))))return json({ok:false,error:'Sign in again.'},401,cors);
      let body={};try{body=await request.json()}catch(_e){return json({ok:false,error:'Invalid JSON.'},400,cors)}
      try{
        if(body?.action==='save'){
          const result=await savePreset(env,body.preset);
          return json({ok:true,presets:result.presets,commit:result.commit,saved:result.preset},200,cors);
        }
        if(body?.action==='delete'){
          const id=String(body.id||'');
          if(!id)return json({ok:false,error:'Choose a preset.'},400,cors);
          const result=await deletePreset(env,id);
          return json({ok:true,presets:result.presets,commit:result.commit},200,cors);
        }
        return json({ok:false,error:'Unknown preset action.'},400,cors);
      }catch(error){
        return json({ok:false,error:String(error?.message||error)},502,cors);
      }
    }


    if(url.pathname==='/manage/github-playlists'&&['GET','POST'].includes(request.method)){
      return handleGithubPlaylists(request,env,cors);
    }

    // Fan identities require the FULL Vault admin credential, not the
    // narrower Access Codes bridge token. Only the owner may link records.
    if(url.pathname==='/manage/fan-access'&&['GET','POST'].includes(request.method)){
      if(!(await verifySession(env,bearer(request))))
        return json({ok:false,error:'Sign in to the Back Room again.'},401,cors);
      if(!String(env.VAULT_ADMIN_TOKEN||'').trim())
        return json({ok:false,error:'Fan integration needs the full Vault admin token configured on Publisher.'},503,cors);
      let body=null;
      if(request.method==='POST'){
        try{body=await request.json()}catch(_){return json({ok:false,error:'Invalid fan assignment request.'},400,cors)}
        if(!['assign','label'].includes(body?.action))return json({ok:false,error:'Unknown fan assignment action.'},400,cors);
      }
      const upstream=await geVaultBridge(env,'/v1/admin/fan-access',request.method,body);
      return json(upstream.data,upstream.status,cors);
    }
    if((url.pathname==='/manage/playlists'||url.pathname==='/manage/access-codes')&&['GET','POST'].includes(request.method)){
      if(!(await verifySession(env,bearer(request))))return json({ok:false,error:'Sign in to the Back Room again.'},401,cors);
      const isPlaylists=url.pathname==='/manage/playlists';
      if(request.method==='GET'){
        const upstream=await geVaultBridge(env,isPlaylists?'/v1/playlists':'/v1/admin/access-codes');
        return json(upstream.data,upstream.status,cors);
      }
      let body={};try{body=await request.json()}catch(_e){return json({ok:false,error:'Invalid request.'},400,cors)}
      if(isPlaylists){
        const action=String(body.action||'');
        if(action==='save'){
          const p=body.playlist||{};
          const name=String(p.name||'').trim().slice(0,100);
          if(!name)return json({ok:false,error:'Enter a playlist name.'},400,cors);
          const tracks=Array.isArray(p.tracks)?p.tracks.slice(0,500):[];
          if(!tracks.length)return json({ok:false,error:'Choose at least one track.'},400,cors);
          const validated=tracks.map(x=>({track_path:String(x.track_path||'').slice(0,600),track_title:String(x.track_title||'').slice(0,300),album:String(x.album||'').slice(0,160)}));
          if(validated.some(x=>!x.track_path.startsWith('ge-music/music/')))return json({ok:false,error:'Only GE Music tracks can be used.'},400,cors);
          // GE Vault owns playlist visibility. Only authenticated Back Room
          // sessions can set this flag; a public browser cannot publish lists.
          const payload={id:String(p.id||'').slice(0,100),name,tracks:validated,
            active:!!p.active,locked:!!p.locked,notes:String(p.notes||'').slice(0,500),
            metadata:{source:'ge-vault',public:!!p.public}};
          const upstream=await geVaultBridge(env,'/v1/playlists','PUT',payload);
          return json(upstream.data,upstream.status,cors);
        }
        if(action==='delete'){
          const id=String(body.id||'');
          if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return json({ok:false,error:'Invalid playlist identifier.'},400,cors);
          const upstream=await geVaultBridge(env,'/v1/playlists/'+encodeURIComponent(id),'DELETE');
          return json(upstream.data,upstream.status,cors);
        }
        return json({ok:false,error:'Unknown playlist action.'},400,cors);
      }
      // The Vault validates scope, limits, entropy, HMAC hashes and authorization.
      if(!['issue','edit','reveal','rotate','activate','suspend','revoke','delete','master'].includes(String(body.action||''))){
        return json({ok:false,error:'Unknown access-code action.'},400,cors);
      }
      const upstream=await geVaultBridge(env,'/v1/admin/access-codes','POST',body);
      return json(upstream.data,upstream.status,cors);
    }

    if(url.pathname==='/publish'&&request.method==='POST'){
      if(!(await verifySession(env,bearer(request))))return json({ok:false,error:'Sign in again.'},401,cors);
      let body={};try{body=await request.json()}catch(_e){return json({ok:false,error:'Invalid JSON.'},400,cors)}
      const cfg=body?.config;
      if(!validConfig(cfg))return json({ok:false,error:'Configuration is incomplete.'},400,cors);
      try{
        const result=await publishLive(env,cfg);
        return json({ok:true,commit:result.commit,contentSha:result.contentSha,publishedAt:result.config.publishedAt},200,cors);
      }catch(error){
        return json({ok:false,error:String(error?.message||error)},502,cors);
      }
    }

    return json({ok:false,error:'Not found.'},404,cors);
  }
};
