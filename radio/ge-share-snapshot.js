/* Grand Element share contract v1. Pure, immutable playlist snapshots.
   A link never conveys payment, access, downloads or Vault authority. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.GEShareSnapshot=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const validKind=new Set(['song','album','playlist','user','selection']);
 function canonical(path){
  try{
   const u=new URL(String(path||''),'https://grand-element.invalid/');
   const p=decodeURI(u.pathname).replace(/^\/+/, '');
   return p||'';
  }catch(_){return String(path||'').split(/[?#]/)[0].replace(/^\/+/, '');}
 }
 function hash(path){
  const p=canonical(path);if(!p)return '';
  let h=2166136261;
  for(let i=0;i<p.length;i++){h^=p.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36).padStart(7,'0');
 }
 function normalize(selection){
  const paths=[...new Set((selection?.paths||[]).map(canonical).filter(Boolean))];
  if(!paths.length)throw Error('Choose at least one song or album to share.');
  if(paths.length>250)throw Error('This playlist exceeds the 250-song share limit.');
  const tokens=paths.map(hash);
  if(new Set(tokens).size!==tokens.length)throw Error('Song identity collision.');
  const requested=canonical(selection.startPath);
  const startIndex=paths.indexOf(requested);
  if(requested&&startIndex<0)throw Error('Current playing song is not in the active playlist.');
  return Object.freeze({paths:Object.freeze(paths),tokens:Object.freeze(tokens),
   startIndex:startIndex<0?0:startIndex,
   name:String(selection.name||'My music').trim().slice(0,80)||'My music',
   kind:validKind.has(selection.kind)?selection.kind:'playlist',
   id:/^[a-zA-Z0-9_-]{1,100}$/.test(selection.id||'')?selection.id:''});
 }
 function write(url,selection){
  const s=normalize(selection),p=url.searchParams;
  p.set('mix',s.tokens.join('.'));p.set('name',s.name);p.set('kind',s.kind);
  p.set('start',String(s.startIndex));p.set('start_id',s.tokens[s.startIndex]);
  p.set('song',s.paths[s.startIndex].split('/').pop());
  if(s.kind==='album')p.set('album',s.name);else p.delete('album');
  if(s.kind==='playlist'&&s.id)p.set('playlist_id',s.id);
  if(url.href.length>5000)throw Error('Share URL too long. Choose fewer songs.');
  return url.href;
 }
 function read(params,catalog){
  const raw=params.get('mix');if(!raw)return null;
  const tokens=raw.split('.');
  if(!tokens.length||tokens.length>250||tokens.some(t=>!/^[a-z0-9]{7}$/.test(t)))
   return {error:'Invalid shared playlist link.'};
  const map=new Map(),collision=new Set();
  for(const entry of catalog||[]){
   const path=canonical(entry),token=hash(path);
   if(map.has(token)&&map.get(token)!==path)collision.add(token);
   map.set(token,path);
  }
  if(tokens.some(t=>collision.has(t)))return {error:'Shared song identity collision.'};
  const paths=tokens.map(t=>map.get(t)||'');
  if(paths.some(p=>!p))return {error:'Some shared songs are missing from the catalog.'};
  if(new Set(paths).size!==paths.length)return {error:'Shared playlist contains duplicate songs.'};
  const idxRaw=params.get('start'),id=params.get('start_id');
  let idx=0;
  if(idxRaw!==null||id!==null){
   if(!/^(0|[1-9][0-9]*)$/.test(idxRaw||'')||Number(idxRaw)>=paths.length||
     id!==tokens[Number(idxRaw)])return {error:'Shared starting song could not be verified.'};
   idx=Number(idxRaw);
  }else if(params.has('song')){
   const name=params.get('song').toLowerCase();
   const matches=paths.map((p,i)=>p.split('/').pop().toLowerCase()===name?i:-1).filter(i=>i>=0);
   if(matches.length!==1)return {error:'Shared starting song is ambiguous.'};
   idx=matches[0];
  }
  return {name:String(params.get('name')||'Shared playlist').slice(0,80),
   kind:String(params.get('kind')||'playlist').slice(0,24),paths,startPath:paths[idx]};
 }
 return Object.freeze({canonical,hash,normalize,write,read});
});
