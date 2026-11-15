/* GE Studios: optional private R2 music gateway.
 * This route is fail-closed until a PRIVATE R2 binding and signing secret exist.
 * No public index, list, file count, or unauthenticated audio access.
 * It does not alter existing Radio URLs or saved audio during migration.
 */
const te = new TextEncoder();
const AUDIO_KEY=/^ge-music\/music\/.+\.(?:mp3|m4a|wav|ogg)$/i;
const PREFIX='/v1/private/music/file/';
const MAX_TTL=600; // only short-lived signed playback URLs

function reply(data,status=200){
 return new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
 });
}
function keyPath(value){
 const path=String(value||'');
 if(path.length>1024||!AUDIO_KEY.test(path)||/[\\?#\u0000-\u001f]/.test(path))return '';
 if(path.split('/').some(segment=>segment===''||segment==='.'||segment==='..'))return '';
 return path;
}
async function signature(value,secret){
 const k=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const raw=new Uint8Array(await crypto.subtle.sign('HMAC',k,te.encode(value)));
 return [...raw].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function sameHex(a,b){
 if(!/^[0-9a-f]{64}$/.test(String(a||''))||!/^[0-9a-f]{64}$/.test(String(b||'')))return false;
 let mismatch=0;
 for(let i=0;i<64;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
 return mismatch===0;
}
function privateReady(env){
 return !!(env?.GE_PRIVATE_AUDIO?.get&&env?.GE_PRIVATE_AUDIO?.head&&String(env?.GE_PRIVATE_MEDIA_SIGNING_KEY||'').length>=32);
}
function encodedPath(path){
 return path.split('/').map(encodeURIComponent).join('/');
}
function errorMessage(status){
 return status===403?'Not authorized':status===404?'Audio unavailable':
  status===503?'Private music storage unavailable':'Invalid media request';
}
export async function handlePrivateMusic(request,env,authorize){
 const url=new URL(request.url);
 const signRoute=url.pathname==='/v1/private/music/sign';
 const fileRoute=url.pathname.startsWith(PREFIX);
 if(!signRoute&&!fileRoute)return null;
 if(!privateReady(env))return reply({ok:false,error:errorMessage(503)},503);
 try{
  if(signRoute){
   if(request.method!=='POST')return reply({ok:false,error:'Method not allowed'},405);
   if(Number(request.headers.get('content-length')||0)>8192)return reply({ok:false,error:'Request too large'},413);
   let body;
   try{body=await request.json()}catch(_){return reply({ok:false,error:'Invalid request'},400)}
   const path=keyPath(body?.track_path),token=String(body?.token||'');
   if(!path||token.length<40||token.length>1024)return reply({ok:false,error:errorMessage(403)},403);
   if(!(await authorize(token,path)))return reply({ok:false,error:errorMessage(403)},403);
   const object=await env.GE_PRIVATE_AUDIO.head(path);
   if(!object)return reply({ok:false,error:errorMessage(404)},404);
   const expires=Math.floor(Date.now()/1000)+MAX_TTL;
   const mac=await signature(path+'\n'+expires,env.GE_PRIVATE_MEDIA_SIGNING_KEY);
   const target=new URL(PREFIX+encodedPath(path),url.origin);
   target.searchParams.set('expires',String(expires));
   target.searchParams.set('sig',mac);
   return reply({ok:true,url:target.href,expires_at:expires});
  }
  if(request.method!=='GET'&&request.method!=='HEAD')
   return reply({ok:false,error:'Method not allowed'},405);
  let path;
  try{path=keyPath(decodeURIComponent(url.pathname.slice(PREFIX.length)))}catch(_){path=''}
  const expires=Number(url.searchParams.get('expires')),mac=String(url.searchParams.get('sig')||'');
  if(!path||!Number.isSafeInteger(expires)||expires<Math.floor(Date.now()/1000)||
     expires>Math.floor(Date.now()/1000)+MAX_TTL||!/^[0-9a-f]{64}$/.test(mac))
   return reply({ok:false,error:errorMessage(403)},403);
  const wanted=await signature(path+'\n'+expires,env.GE_PRIVATE_MEDIA_SIGNING_KEY);
  if(!sameHex(wanted,mac))return reply({ok:false,error:errorMessage(403)},403);
  const metadata=await env.GE_PRIVATE_AUDIO.head(path);
  if(!metadata)return reply({ok:false,error:errorMessage(404)},404);
  const size=Number(metadata.size);
  if(!Number.isSafeInteger(size)||size<1)return reply({ok:false,error:errorMessage(404)},404);
  const rangeHeader=request.headers.get('range');
  let range=null;
  if(rangeHeader){
   const m=/^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
   if(!m)return new Response(null,{status:416,headers:{'content-range':'bytes */'+size,'cache-control':'no-store'}});
   const start=Number(m[1]),end=m[2]?Number(m[2]):size-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)
    return new Response(null,{status:416,headers:{'content-range':'bytes */'+size,'cache-control':'no-store'}});
   range={offset:start,length:Math.min(size-1,end)-start+1};
  }
  const headers=new Headers({
   'cache-control':'private, no-store',
   'referrer-policy':'no-referrer',
   'x-content-type-options':'nosniff',
   'accept-ranges':'bytes',
   'content-type':path.endsWith('.wav')?'audio/wav':path.endsWith('.m4a')?'audio/mp4':
    path.endsWith('.ogg')?'audio/ogg':'audio/mpeg',
   'access-control-expose-headers':'Accept-Ranges, Content-Range, Content-Length',
   'content-length':String(range?range.length:size)
  });
  if(range)headers.set('content-range','bytes '+range.offset+'-'+(range.offset+range.length-1)+'/'+size);
  if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
  const object=await env.GE_PRIVATE_AUDIO.get(path,range?{range}:undefined);
  if(!object?.body)return reply({ok:false,error:errorMessage(404)},404);
  return new Response(object.body,{status:range?206:200,headers});
 }catch(error){
  // Do not leak access codes, signatures, R2 keys, or internal storage details.
  console.error('GE private music request failed',String(error?.name||'Error'));
  return reply({ok:false,error:'Private music is temporarily unavailable'},503);
 }
}
