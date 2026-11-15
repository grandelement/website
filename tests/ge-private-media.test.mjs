import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePrivateMusic} from '../vault-worker/src/private-media.mjs';

const origin='https://vault.grandelement.com';
const track='ge-music/music/Grand Element - Test/Test_01_Recording.mp3';
const bytes=Uint8Array.from({length:512},(_,i)=>i%255);
const KEY='test-private-media-signing-secret-kept-out-of-repository';
const token='a'.repeat(72);
function harness({configured=true,grant=true}={}){
 const calls={head:[],get:[],verify:[]};
 const env={
  GE_PRIVATE_MEDIA_SIGNING_KEY:configured?KEY:undefined,
  GE_PRIVATE_AUDIO:configured?{
   async head(key){calls.head.push(key);return key===track?{size:bytes.length}:null},
   async get(key,options){
    calls.get.push({key,options});
    if(key!==track)return null;
    let body=bytes;
    if(options?.range)body=bytes.slice(options.range.offset,options.range.offset+options.range.length);
    return {body:new Response(body).body};
   }
  }:undefined
 };
 const authorize=async(t,p)=>{calls.verify.push({token:t,path:p});return grant&&t===token&&p===track};
 const run=request=>handlePrivateMusic(request,env,authorize);
 const post=(path,tok=token)=>run(new Request(origin+'/v1/private/music/sign',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({track_path:path,token:tok})
 }));
 const sign=async()=>{const r=await post(track);assert.equal(r.status,200);return (await r.json()).url};
 return {run,post,sign,calls,env};
}
test('R2 gateway fails closed when private bucket or signing key is absent',async()=>{
 const h=harness({configured:false});
 const response=await h.post(track);
 assert.equal(response.status,503);
 assert.equal(h.calls.verify.length,0);
});
test('a revoked or unassigned Music session cannot sign a media URL',async()=>{
 const h=harness({grant:false});
 assert.equal((await h.post(track)).status,403);
 assert.equal(h.calls.get.length,0);
 assert.equal(h.calls.head.length,0);
});
test('signing never returns file counts, inventory or the session token',async()=>{
 const h=harness(),r=await h.post(track);
 const body=await r.json();
 assert.equal(r.status,200);
 assert.deepEqual(Object.keys(body).sort(),['expires_at','ok','url']);
 assert.equal(body.url.includes(token),false);
 assert.match(body.url,/^https:\/\/vault\.grandelement\.com\/v1\/private\/music\/file\//);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('signed private file streams but is inaccessible without signature',async()=>{
 const h=harness();
 const url=await h.sign();
 const forbidden=await h.run(new Request(url.replace(/sig=[0-9a-f]{64}/,'sig='+'f'.repeat(64))));
 assert.equal(forbidden.status,403);
 const unauthed=await h.run(new Request(url.split('?')[0]));
 assert.equal(unauthed.status,403);
 const good=await h.run(new Request(url));
 assert.equal(good.status,200);
 assert.equal(good.headers.get('cache-control'),'private, no-store');
 assert.equal(good.headers.get('content-length'),String(bytes.length));
 assert.deepEqual(new Uint8Array(await good.arrayBuffer()),bytes);
});
test('byte ranges support iPhone seeking',async()=>{
 const h=harness(),url=await h.sign();
 const r=await h.run(new Request(url,{headers:{range:'bytes=30-39'}}));
 assert.equal(r.status,206);
 assert.equal(r.headers.get('content-range'),'bytes 30-39/512');
 assert.equal(r.headers.get('content-length'),'10');
 assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes.slice(30,40));
 const head=await h.run(new Request(url,{method:'HEAD'}));
 assert.equal(head.status,200);
 assert.equal((await head.arrayBuffer()).byteLength,0);
});
test('invalid range fails safely',async()=>{
 const h=harness(),url=await h.sign();
 const r=await h.run(new Request(url,{headers:{range:'bytes=99999-999999'}}));
 assert.equal(r.status,416);
 assert.equal(r.headers.get('content-range'),'bytes */512');
});
test('path traversal and invalid files never reach R2',async()=>{
 const h=harness();
 for(const p of ['ge-music/music/../private.mp3','ge-music/music/not-a-song.exe','ge-music/music/Album/../../admin.mp3']){
  assert.equal((await h.post(p)).status,403);
 }
 assert.equal(h.calls.head.length,0);
});
