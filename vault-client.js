/* GE Studios Vault client — public-safe. No secrets belong in this file.
   Permanent data lives in the private Cloudflare Vault. localStorage is cache/fallback only. */
(function(){
  'use strict';
  const BASE='https://vault.grandelement.com';
  const EVENT_URL=BASE+'/v1/public/event';
  const SCORE_URL=BASE+'/v1/public/game-scores';
  const ANON_KEY='GE_VAULT_ANON_V1';
  const SESSION_KEY='GE_VAULT_SESSION_V1';
  const SCORE_KEY='GE_GAME_SCORES_V3';
  const SCORE_MIGRATION_KEY='GE_VAULT_SCORES_MIGRATED_V1';

  function uid(prefix){
    try{return prefix+'-'+crypto.randomUUID()}catch(_e){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
  }
  function getAnon(){
    try{
      let v=localStorage.getItem(ANON_KEY)||'';
      if(!v){v=uid('anon');localStorage.setItem(ANON_KEY,v)}
      return v;
    }catch(_e){return uid('anon-temp')}
  }
  function getSession(){
    try{
      let v=sessionStorage.getItem(SESSION_KEY)||'';
      if(!v){v=uid('session');sessionStorage.setItem(SESSION_KEY,v)}
      return v;
    }catch(_e){return uid('session-temp')}
  }
  function surface(){
    const p=location.pathname.toLowerCase();
    if(p.includes('/radio'))return 'radio';
    if(p.includes('/studio'))return 'studio';
    return 'website';
  }
  function cleanTrack(src){
    if(!src)return '';
    try{return decodeURIComponent(new URL(src,location.href).pathname).slice(0,300)}catch(_e){return String(src).split('?')[0].slice(0,300)}
  }
  async function track(event_type,metadata={},extra={}){
    const payload={
      event_type:String(event_type||'').toLowerCase(),
      anon_id:getAnon(),
      session_id:getSession(),
      surface:surface(),
      page_path:location.pathname,
      referrer:document.referrer||'',
      track_id:extra.track_id||'',
      playlist_id:extra.playlist_id||'',
      metadata:metadata&&typeof metadata==='object'?metadata:{value:metadata}
    };
    try{
      const r=await fetch(EVENT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true,cache:'no-store'});
      return r.ok;
    }catch(_e){return false}
  }

  function localScores(){
    try{const v=JSON.parse(localStorage.getItem(SCORE_KEY)||'[]');return Array.isArray(v)?v:[]}catch(_e){return []}
  }
  function rankScores(rows){
    return rows.slice().sort((a,b)=>{
      const at=Number(a.winningThrows)||Number.MAX_SAFE_INTEGER;
      const bt=Number(b.winningThrows)||Number.MAX_SAFE_INTEGER;
      return (at-bt)||(Number(b.score||0)-Number(a.score||0))||String(b.completedAt||'').localeCompare(String(a.completedAt||''));
    });
  }
  function cacheScores(rows){
    try{localStorage.setItem(SCORE_KEY,JSON.stringify(rankScores(rows).slice(0,250)))}catch(_e){}
  }
  async function postScore(record){
    if(!record||!record.id)return false;
    const body={...record,anon_id:getAnon()};
    try{
      const r=await fetch(SCORE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,cache:'no-store'});
      return r.ok;
    }catch(_e){return false}
  }
  async function syncGameScores(){
    const local=localScores();
    let migrated=false;
    try{migrated=localStorage.getItem(SCORE_MIGRATION_KEY)==='1'}catch(_e){}
    if(!migrated&&local.length){
      let ok=true;
      for(const row of local.slice(0,100)){if(!(await postScore(row)))ok=false}
      if(ok)try{localStorage.setItem(SCORE_MIGRATION_KEY,'1')}catch(_e){}
    }
    try{
      const r=await fetch(SCORE_URL+'?limit=250',{cache:'no-store'});
      if(!r.ok)return local;
      const d=await r.json();
      const remote=Array.isArray(d.items)?d.items:[];
      const map=new Map();
      remote.forEach(x=>{if(x&&x.id)map.set(String(x.id),x)});
      local.forEach(x=>{if(x&&x.id&&!map.has(String(x.id)))map.set(String(x.id),x)});
      const merged=rankScores([...map.values()]);
      cacheScores(merged);
      window.dispatchEvent(new CustomEvent('ge-vault-scores-updated',{detail:{count:merged.length}}));
      return merged;
    }catch(_e){return local}
  }

  window.GE_SCORE_ENDPOINT=SCORE_URL;
  window.GEVault=Object.freeze({
    base:BASE,
    eventUrl:EVENT_URL,
    scoreUrl:SCORE_URL,
    anonId:getAnon,
    sessionId:getSession,
    track,
    postScore,
    syncGameScores
  });

  function audioMeta(el){
    return {src:cleanTrack(el.currentSrc||el.src||''),currentTime:Number(el.currentTime||0),duration:Number.isFinite(el.duration)?Number(el.duration):null};
  }
  document.addEventListener('play',e=>{if(e.target instanceof HTMLMediaElement)track('audio_play',audioMeta(e.target),{track_id:cleanTrack(e.target.currentSrc||e.target.src)})},true);
  document.addEventListener('ended',e=>{if(e.target instanceof HTMLMediaElement)track('audio_end',audioMeta(e.target),{track_id:cleanTrack(e.target.currentSrc||e.target.src)})},true);
  document.addEventListener('pause',e=>{if(e.target instanceof HTMLMediaElement&&!e.target.ended)track('audio_pause',audioMeta(e.target),{track_id:cleanTrack(e.target.currentSrc||e.target.src)})},true);

  document.addEventListener('click',e=>{
    const el=e.target&&e.target.closest?e.target.closest('button,a,[data-ge-event]'):null;
    if(!el)return;
    const explicit=el.getAttribute('data-ge-event');
    if(explicit)track(explicit,{id:el.id||'',label:(el.textContent||'').trim().slice(0,100)});
    const id=(el.id||'').toLowerCase();
    const label=(el.textContent||'').trim();
    if(id.includes('share')||/\bshare\b/i.test(label))track('track_share',{control:el.id||label.slice(0,80)});
    if(el.tagName==='A'){
      try{
        const u=new URL(el.href,location.href);
        if(u.origin!==location.origin)track('external_link',{host:u.host,path:u.pathname,label:label.slice(0,100)});
      }catch(_e){}
    }
    if(id==='livebtn')track('radio_live',{state:el.getAttribute('aria-pressed')||''});
  },true);

  function start(){
    track('page_view',{title:document.title||'',language:navigator.language||'',standalone:!!(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)});
    syncGameScores().catch(()=>{});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
