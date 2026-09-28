/* GE Studios Vault Client
   Public browser helper. Contains NO secrets.
   Canonical permanent master: https://vault.grandelement.com
*/
(function(global){
  'use strict';
  const BASE='https://vault.grandelement.com';
  const EVENT_URL=BASE+'/v1/public/event';
  const SCORE_URL=BASE+'/v1/public/game-scores';
  const ANON_KEY='GE_VAULT_ANON_V1';
  const SESSION_KEY='GE_VAULT_SESSION_V1';
  const SCORE_KEY='GE_GAME_SCORES_V3';
  const SCORE_MIGRATION_KEY='GE_VAULT_SCORES_MIGRATED_V1';

  function randomId(prefix){
    const core=(global.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2));
    return prefix+'-'+core;
  }
  function getLocal(key,prefix){
    try{
      let v=localStorage.getItem(key)||'';
      if(!v){v=randomId(prefix);localStorage.setItem(key,v);}
      return v;
    }catch(_e){return randomId(prefix);}
  }
  function getSession(){
    try{
      let v=sessionStorage.getItem(SESSION_KEY)||'';
      if(!v){v=randomId('session');sessionStorage.setItem(SESSION_KEY,v);}
      return v;
    }catch(_e){return randomId('session');}
  }
  const anonId=getLocal(ANON_KEY,'visitor');
  const sessionId=getSession();

  function inferSurface(){
    const p=location.pathname.toLowerCase();
    if(p.includes('/radio'))return 'radio';
    if(p.includes('/studio'))return 'studio';
    return 'website';
  }
  function base(surface){
    const u=new URL(location.href);
    return {
      anon_id:anonId,
      session_id:sessionId,
      surface:String(surface||inferSurface()).toLowerCase(),
      page_path:u.pathname,
      referrer:document.referrer||'',
      metadata:{
        language:navigator.language||'',
        utm_source:u.searchParams.get('utm_source')||'',
        utm_medium:u.searchParams.get('utm_medium')||'',
        utm_campaign:u.searchParams.get('utm_campaign')||'',
        utm_content:u.searchParams.get('utm_content')||'',
        utm_term:u.searchParams.get('utm_term')||''
      }
    };
  }
  function mergeMetadata(baseMeta,dataMeta){
    return {...(baseMeta||{}),...(dataMeta&&typeof dataMeta==='object'?dataMeta:{})};
  }
  function sendEvent(payload,{beacon=false}={}){
    const body=JSON.stringify(payload);
    try{
      if(beacon&&navigator.sendBeacon){
        return navigator.sendBeacon(EVENT_URL,new Blob([body],{type:'application/json'}));
      }
    }catch(_e){}
    return fetch(EVENT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,credentials:'omit',cache:'no-store'}).catch(()=>null);
  }

  // Supports both:
  //   GEVault.track('event_name', data)
  //   GEVault.track('surface','event_name', data)
  function track(a,b={},c={}){
    let surface,eventType,data;
    if(typeof b==='string'){
      surface=String(a||inferSurface());eventType=b;data=c||{};
    }else{
      surface=inferSurface();eventType=String(a||'');data=b||{};
    }
    const payload=base(surface);
    const metadata={...(data.metadata&&typeof data.metadata==='object'?data.metadata:{}),...data};
    delete metadata.track_id;delete metadata.playlist_id;delete metadata.metadata;
    payload.metadata=mergeMetadata(payload.metadata,metadata);
    payload.event_type=eventType;
    payload.track_id=data.track_id||'';
    payload.playlist_id=data.playlist_id||'';
    return sendEvent(payload);
  }
  function trackExit(surface,data={}){
    const payload=base(surface||inferSurface());
    payload.event_type='session_end';
    payload.metadata=mergeMetadata(payload.metadata,data.metadata||data);
    return sendEvent(payload,{beacon:true});
  }

  function cleanTrack(src){
    if(!src)return '';
    try{return decodeURIComponent(new URL(src,location.href).pathname).slice(0,300)}catch(_e){return String(src).split('?')[0].slice(0,300)}
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
    try{
      const r=await fetch(SCORE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,anon_id:anonId}),keepalive:true,credentials:'omit',cache:'no-store'});
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
      const r=await fetch(SCORE_URL+'?limit=250',{cache:'no-store',credentials:'omit'});
      if(!r.ok)return local;
      const d=await r.json();
      const remote=Array.isArray(d.items)?d.items:[];
      const map=new Map();
      remote.forEach(x=>{if(x&&x.id)map.set(String(x.id),x)});
      local.forEach(x=>{if(x&&x.id&&!map.has(String(x.id)))map.set(String(x.id),x)});
      const merged=rankScores([...map.values()]);
      cacheScores(merged);
      global.dispatchEvent(new CustomEvent('ge-vault-scores-updated',{detail:{count:merged.length}}));
      return merged;
    }catch(_e){return local}
  }

  global.GE_SCORE_ENDPOINT=SCORE_URL;
  global.GEVault=Object.freeze({
    base:BASE,
    endpoint:EVENT_URL,
    eventUrl:EVENT_URL,
    scoreUrl:SCORE_URL,
    anonId,
    sessionId,
    track,
    trackExit,
    postScore,
    syncGameScores,
    pageView:(surface='website',data={})=>track(surface,'page_view',data),
    radio:(eventType,data={})=>track('radio',eventType,data),
    website:(eventType,data={})=>track('website',eventType,data),
    ship:(eventType,data={})=>track('ship',eventType,data)
  });

  // Automatic baseline telemetry shared by Website + Radio.
  const surface=inferSurface();
  track(surface,'session_start',{metadata:{visibility:document.visibilityState}});
  track(surface,'page_view',{metadata:{title:document.title||'',standalone:!!(global.matchMedia&&matchMedia('(display-mode: standalone)').matches)}});
  global.addEventListener('pagehide',()=>trackExit(surface,{metadata:{reason:'pagehide'}}),{once:true});

  // Audio lifecycle.
  function audioMeta(el){
    return {src:cleanTrack(el.currentSrc||el.src||''),currentTime:Number(el.currentTime||0),duration:Number.isFinite(el.duration)?Number(el.duration):null};
  }
  document.addEventListener('play',e=>{if(e.target instanceof HTMLMediaElement)track(surface,'audio_play',{...audioMeta(e.target),track_id:cleanTrack(e.target.currentSrc||e.target.src)})},true);
  document.addEventListener('ended',e=>{if(e.target instanceof HTMLMediaElement)track(surface,'audio_end',{...audioMeta(e.target),track_id:cleanTrack(e.target.currentSrc||e.target.src)})},true);
  document.addEventListener('pause',e=>{if(e.target instanceof HTMLMediaElement&&!e.target.ended)track(surface,'audio_pause',{...audioMeta(e.target),track_id:cleanTrack(e.target.currentSrc||e.target.src)})},true);

  // Observable interaction tracking. We record share invocation, not claims about what happened after the OS share sheet takes over.
  document.addEventListener('click',e=>{
    const el=e.target&&e.target.closest?e.target.closest('button,a,[data-ge-event]'):null;
    if(!el)return;
    const explicit=el.getAttribute('data-ge-event');
    if(explicit)track(surface,explicit,{id:el.id||'',label:(el.textContent||'').trim().slice(0,100)});
    const id=(el.id||'').toLowerCase(),label=(el.textContent||'').trim();
    if(id.includes('share')||/\bshare\b/i.test(label))track(surface,'track_share',{control:el.id||label.slice(0,80)});
    if(el.tagName==='A'){
      try{const u=new URL(el.href,location.href);if(u.origin!==location.origin)track(surface,'external_link',{host:u.host,path:u.pathname,label:label.slice(0,100)})}catch(_e){}
    }
    if(id==='livebtn')track('radio','radio_live',{state:el.getAttribute('aria-pressed')||''});
  },true);

  syncGameScores().catch(()=>{});
})(window);
