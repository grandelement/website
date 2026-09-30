/**
 * GE Studios Website Back Room Publisher
 * Cloudflare Worker
 *
 * Secrets required in Cloudflare:
 *   BACKROOM_PASSWORD   admin password (never commit it)
 *   SESSION_SECRET      long random signing secret
 *   GITHUB_TOKEN        fine-grained token: Contents read/write on grandelement/website only
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
async function github(env,path,init={}){
  const owner=env.GITHUB_OWNER||'grandelement';
  const repo=env.GITHUB_REPO||'website';
  return fetch('https://api.github.com/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/contents/'+path,{
    ...init,
    headers:{
      'Accept':'application/vnd.github+json',
      'Authorization':'Bearer '+env.GITHUB_TOKEN,
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
    const configured=!!(env.BACKROOM_PASSWORD&&env.SESSION_SECRET&&env.GITHUB_TOKEN);

    if(url.pathname==='/health'&&request.method==='GET'){
      return json({ok:true,configured},200,cors);
    }
    if(!configured)return json({ok:false,error:'Publisher secrets are not configured.'},503,cors);

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
