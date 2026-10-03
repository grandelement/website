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
  const ACQ_KEY='GE_VAULT_ACQUISITION_V1';
  const SCORE_KEY='GE_GAME_SCORES_V3';
  const OWNER_UX_KEY='GE_OWNER_UX_MODE_V1';
  const SCORE_MIGRATION_KEY='GE_VAULT_SCORES_MIGRATED_V1';
  const RIGHTS_URL='/ge-music/ascap-work-ids.json';
  const MEDIA_PROGRESS_MS=30000;
  const rightsByTitle=new Map();

  function normalizeWorkTitle(value){
    return String(value||'').toUpperCase().replace(/[^A-Z0-9=]+/g,' ').trim();
  }
  function loadRightsCatalog(){
    return fetch(RIGHTS_URL,{cache:'no-store',credentials:'same-origin'})
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        (data&&Array.isArray(data.works)?data.works:[]).forEach(work=>{
          const names=[work.title,...(Array.isArray(work.aliases)?work.aliases:[])];
          names.forEach(name=>{
            const key=normalizeWorkTitle(name);
            if(key)rightsByTitle.set(key,{
              ascap_work_id:String(work.work_id||''),
              ascap_title:String(work.title||''),
              ascap_status:String(work.status||'')
            });
          });
        });
        return rightsByTitle.size;
      }).catch(()=>0);
  }

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
  function readLocalJson(key,fallback){
    try{
      const v=JSON.parse(localStorage.getItem(key)||'null');
      return v&&typeof v==='object'?v:fallback;
    }catch(_e){return fallback;}
  }
  function writeLocalJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));}catch(_e){}
  }

  const anonId=getLocal(ANON_KEY,'visitor');
  const sessionId=getSession();
  const sessionStartedAt=Date.now();

  function inferSurface(){
    const p=location.pathname.toLowerCase();
    if(p.includes('/radio'))return 'radio';
    if(p.includes('/studio'))return 'studio';
    if(p.includes('/dj'))return 'dj';
    return 'website';
  }

  function currentTouch(){
    const u=new URL(location.href);
    const isQr=u.pathname==='/qr'||u.pathname==='/qr/';
    const campaign=u.searchParams.get('c')||(isQr?'worldwide-sticker':'');
    const qrId=u.searchParams.get('qr')||u.searchParams.get('qid')||'';
    const placement=u.searchParams.get('placement')||u.searchParams.get('p')||'';
    const variant=u.searchParams.get('variant')||u.searchParams.get('v')||'';
    let utmSource=u.searchParams.get('utm_source')||'';
    let utmMedium=u.searchParams.get('utm_medium')||'';
    let utmCampaign=u.searchParams.get('utm_campaign')||'';
    if(campaign){
      utmSource=utmSource||'qr';
      utmMedium=utmMedium||'physical';
      utmCampaign=utmCampaign||campaign;
    }
    return {
      at:Date.now(),
      path:u.pathname,
      referrer:document.referrer||'',
      campaign,
      qr_id:qrId,
      placement,
      variant,
      utm_source:utmSource,
      utm_medium:utmMedium,
      utm_campaign:utmCampaign,
      utm_content:u.searchParams.get('utm_content')||'',
      utm_term:u.searchParams.get('utm_term')||''
    };
  }

  function refreshAcquisition(){
    const touch=currentTouch();
    const hasCampaign=!!(touch.campaign||touch.qr_id||touch.placement||touch.utm_source||touch.utm_campaign);
    const saved=readLocalJson(ACQ_KEY,{});
    if(!saved.first&&hasCampaign)saved.first=touch;
    if(hasCampaign)saved.latest=touch;
    if(!saved.first&&document.referrer)saved.first={...touch,at:Date.now()};
    saved.last_seen_at=Date.now();
    writeLocalJson(ACQ_KEY,saved);
    return saved;
  }
  const acquisition=refreshAcquisition();

  function deviceMeta(){
    let connection={};
    try{
      const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      if(c)connection={effective_type:c.effectiveType||'',downlink:Number(c.downlink)||null,rtt:Number(c.rtt)||null,save_data:!!c.saveData};
    }catch(_e){}
    return {
      viewport_width:Math.round(global.innerWidth||0),
      viewport_height:Math.round(global.innerHeight||0),
      screen_width:Math.round(global.screen?.width||0),
      screen_height:Math.round(global.screen?.height||0),
      pixel_ratio:Number(global.devicePixelRatio||1),
      touch_points:Number(navigator.maxTouchPoints||0),
      platform:String(navigator.platform||'').slice(0,80),
      browser_timezone:(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(_e){return '';}})(),
      standalone:!!(global.matchMedia&&matchMedia('(display-mode: standalone)').matches),
      connection
    };
  }

  function acquisitionMeta(){
    const first=acquisition.first||{};
    const latest=acquisition.latest||{};
    return {
      acquisition_first:first,
      acquisition_latest:latest,
      qr_campaign:latest.campaign||first.campaign||'',
      qr_id:latest.qr_id||first.qr_id||'',
      qr_placement:latest.placement||first.placement||'',
      qr_variant:latest.variant||first.variant||''
    };
  }

  function base(surface){
    const u=new URL(location.href);
    const first=acquisition.first||{};
    const latest=acquisition.latest||{};
    const utmSource=u.searchParams.get('utm_source')||latest.utm_source||first.utm_source||'';
    const utmMedium=u.searchParams.get('utm_medium')||latest.utm_medium||first.utm_medium||'';
    const utmCampaign=u.searchParams.get('utm_campaign')||latest.utm_campaign||first.utm_campaign||'';
    const utmContent=u.searchParams.get('utm_content')||latest.utm_content||first.utm_content||'';
    const utmTerm=u.searchParams.get('utm_term')||latest.utm_term||first.utm_term||'';
    return {
      anon_id:anonId,
      session_id:sessionId,
      surface:String(surface||inferSurface()).toLowerCase(),
      page_url:u.origin+u.pathname,
      page_path:u.pathname,
      referrer:document.referrer||'',
      language:navigator.language||'',
      utm_source:utmSource,
      utm_medium:utmMedium,
      utm_campaign:utmCampaign,
      utm_content:utmContent,
      utm_term:utmTerm,
      metadata:{
        language:navigator.language||'',
        utm_source:utmSource,
        utm_medium:utmMedium,
        utm_campaign:utmCampaign,
        utm_content:utmContent,
        utm_term:utmTerm,
        ...acquisitionMeta()
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

  function makePayload(surface,eventType,data={}){
    const payload=base(surface);
    const metadata={...(data.metadata&&typeof data.metadata==='object'?data.metadata:{}),...data};
    delete metadata.track_id;delete metadata.track_title;delete metadata.album;delete metadata.playlist_id;delete metadata.share_target;delete metadata.metadata;
    payload.metadata=mergeMetadata(payload.metadata,metadata);
    payload.event_type=eventType;
    payload.track_id=data.track_id||'';
    payload.track_title=data.track_title||data.title||'';
    payload.album=data.album||'';
    payload.playlist_id=data.playlist_id||'';
    payload.share_target=data.share_target||'';
    return payload;
  }

  // Supports both GEVault.track('event_name',data) and GEVault.track('surface','event_name',data).
  function track(a,b={},c={}){
    let surface,eventType,data;
    if(typeof b==='string'){
      surface=String(a||inferSurface());eventType=b;data=c||{};
    }else{
      surface=inferSurface();eventType=String(a||'');data=b||{};
    }
    return sendEvent(makePayload(surface,eventType,data));
  }
  function trackExit(surface,data={}){
    return sendEvent(makePayload(surface||inferSurface(),'session_end',{
      ...data,
      session_duration_seconds:Math.max(0,Math.round((Date.now()-sessionStartedAt)/1000))
    }),{beacon:true});
  }

  function ownerUxModeEnabled(){
    try{
      const p=new URL(location.href).searchParams.get('ge_ux');
      if(p==='1')localStorage.setItem(OWNER_UX_KEY,'1');
      if(p==='0')localStorage.removeItem(OWNER_UX_KEY);
      return global.GE_SITE_MODE==='test'||global.GE_SITE_MODE==='live-draft'||localStorage.getItem(OWNER_UX_KEY)==='1';
    }catch(_e){
      return global.GE_SITE_MODE==='test'||global.GE_SITE_MODE==='live-draft';
    }
  }
  const OWNER_UX_ENABLED=ownerUxModeEnabled();
  let ownerUxPending={clicks:{},changes:{},transitions:{},backtracks:{},repeats:{},errors:{}};
  let ownerUxViews=[],ownerUxLastClick={key:'',at:0,count:0,burst:false};

  function ownerUxBump(bucket,name,amount=1){
    if(!OWNER_UX_ENABLED||!ownerUxPending[bucket])return;
    name=String(name||'').replace(/\s+/g,' ').trim().slice(0,120);
    if(!name)return;
    ownerUxPending[bucket][name]=(ownerUxPending[bucket][name]||0)+(Number(amount)||1);
  }
  function ownerUxView(){
    const body=document.body;
    if(body&&body.classList.contains('marbles-game-active'))return 'GAME · MARBLES';
    if(body&&body.classList.contains('blue-sun-pool-active'))return 'GAME · BLUE SUN';
    if(body&&body.classList.contains('game-mode-active'))return 'GAME';
    const shown=document.querySelector('.modal.show,.show[role="dialog"],dialog[open]');
    if(shown&&shown.id)return 'OVERLAY · '+String(shown.id).slice(0,70);
    return 'WEBSITE';
  }
  function ownerUxControl(el){
    if(!el)return '';
    if(el.id)return String(el.id).slice(0,100);
    const ev=el.getAttribute&&el.getAttribute('data-ge-event');
    if(ev)return 'event:'+String(ev).slice(0,80);
    const ds=el.dataset||{};
    for(const k of ['act','action','game','mode','view','screen']){
      if(ds[k])return k+':'+String(ds[k]).slice(0,70);
    }
    const aria=el.getAttribute&&el.getAttribute('aria-label');
    if(aria)return 'aria:'+String(aria).replace(/\s+/g,' ').trim().slice(0,70);
    const cls=String(el.className||'').split(/\s+/).find(x=>/^ge|game|radio|planet|album/i.test(x));
    return cls?('class:'+cls.slice(0,70)):String(el.tagName||'CONTROL')
  }
  function ownerUxObserveView(){
    if(!OWNER_UX_ENABLED)return;
    const view=ownerUxView(),last=ownerUxViews[ownerUxViews.length-1];
    if(last===view)return;
    if(last)ownerUxBump('transitions',last+' → '+view);
    ownerUxViews.push(view);if(ownerUxViews.length>8)ownerUxViews.shift();
    const n=ownerUxViews.length;
    if(n>=3){
      const a=ownerUxViews[n-3],b=ownerUxViews[n-2],cc=ownerUxViews[n-1];
      if(a===cc&&a!==b)ownerUxBump('backtracks',a+' ↔ '+b)
    }
  }
  function ownerUxClick(el){
    if(!OWNER_UX_ENABLED)return;
    const key=ownerUxView()+' · '+ownerUxControl(el);
    ownerUxBump('clicks',key);
    const t=Date.now();
    if(ownerUxLastClick.key===key&&t-ownerUxLastClick.at<20000){
      ownerUxLastClick.count++;
      if(ownerUxLastClick.count>=3&&!ownerUxLastClick.burst){ownerUxBump('repeats',key);ownerUxLastClick.burst=true}
    }else ownerUxLastClick={key,at:t,count:1,burst:false};
    ownerUxLastClick.at=t;
    setTimeout(ownerUxObserveView,80)
  }
  function ownerUxHasPending(){
    return OWNER_UX_ENABLED&&Object.keys(ownerUxPending).some(k=>Object.keys(ownerUxPending[k]||{}).length);
  }
  function ownerUxTakePending(){
    const out=ownerUxPending;
    ownerUxPending={clicks:{},changes:{},transitions:{},backtracks:{},repeats:{},errors:{}};
    return out
  }
  function ownerUxFlush(){
    if(!ownerUxHasPending())return Promise.resolve(false);
    const detail=ownerUxTakePending();
    return track('website','owner_ux_batch',{
      metadata:{
        owner_ux:true,
        site_mode:String(global.GE_SITE_MODE||'live'),
        clicks:detail.clicks,
        changes:detail.changes,
        transitions:detail.transitions,
        backtracks:detail.backtracks,
        repeats:detail.repeats,
        errors:detail.errors
      }
    }).catch(()=>{
      Object.keys(detail).forEach(bucket=>{
        Object.keys(detail[bucket]||{}).forEach(name=>{
          ownerUxPending[bucket][name]=(ownerUxPending[bucket][name]||0)+Number(detail[bucket][name]||0)
        })
      });
      return false
    })
  }
  if(OWNER_UX_ENABLED){
    ownerUxViews=[ownerUxView()];
    setInterval(ownerUxFlush,30000);
    global.addEventListener('error',()=>ownerUxBump('errors','JAVASCRIPT ERROR'));
    global.addEventListener('unhandledrejection',()=>ownerUxBump('errors','UNHANDLED PROMISE'));
  }

  function cleanTrack(src){
    if(!src)return '';
    try{return decodeURIComponent(new URL(src,location.href).pathname).slice(0,300);}catch(_e){return String(src).split('?')[0].slice(0,300);}
  }
  function titleFromSrc(src){
    const path=cleanTrack(src);
    const name=(path.split('/').pop()||'').replace(/\.[A-Za-z0-9]{2,5}$/,'');
    return decodeURIComponent(name).replace(/[_-]+/g,' ').replace(/^\d+[ ._-]*/,'').trim().slice(0,300);
  }
  function mediaSessionMeta(){
    try{
      const m=navigator.mediaSession&&navigator.mediaSession.metadata;
      if(!m)return {};
      return {title:m.title||'',artist:m.artist||'',album:m.album||''};
    }catch(_e){return {};}
  }

  const mediaOverrides=new WeakMap();
  const mediaStates=new WeakMap();
  const trackedMedia=new Set();

  function applyRights(meta){
    const rights=rightsByTitle.get(normalizeWorkTitle(meta.track_title||meta.title||''))||{};
    return {
      ...meta,
      ascap_work_id:String(meta.ascap_work_id||meta.work_id||rights.ascap_work_id||'').slice(0,120),
      ascap_title:String(meta.ascap_title||rights.ascap_title||'').slice(0,300),
      ascap_status:String(meta.ascap_status||rights.ascap_status||'').slice(0,80)
    };
  }
  function normalizeMediaMeta(el){
    const src=cleanTrack(el.currentSrc||el.src||'');
    const override=mediaOverrides.get(el)||{};
    const session=mediaSessionMeta();
    const title=String(override.title||override.track_title||session.title||el.dataset?.trackTitle||titleFromSrc(src)||'').slice(0,300);
    const album=String(override.album||session.album||el.dataset?.album||'').slice(0,200);
    const artist=String(override.artist||session.artist||el.dataset?.artist||'Grand Element').slice(0,200);
    const trackId=String(override.track_id||override.work_id||override.iswc||src||title).slice(0,240);
    return applyRights({
      track_id:trackId,
      track_title:title,
      title,
      album,
      artist,
      src,
      source:String(override.source||inferSurface()).slice(0,80),
      live:!!override.live,
      station_id:!!override.station_id,
      ascap_work_id:String(override.ascap_work_id||override.work_id||'').slice(0,120),
      ascap_title:String(override.ascap_title||'').slice(0,300),
      ascap_status:String(override.ascap_status||'').slice(0,80),
      iswc:String(override.iswc||'').slice(0,120),
      writer:String(override.writer||'').slice(0,200),
      publisher:String(override.publisher||'').slice(0,200)
    });
  }
  function mediaKey(meta){
    return [meta.track_id,meta.track_title,meta.album,meta.live?'live':'file'].join('|');
  }
  function accumulateMedia(state){
    if(!state||!state.active||!state.activeSince)return;
    const now=performance.now();
    state.listenedMs+=Math.max(0,now-state.activeSince);
    state.activeSince=now;
  }
  function mediaData(el,state,extra={}){
    const meta=applyRights(state?.meta||normalizeMediaMeta(el));
    const duration=Number.isFinite(el.duration)&&el.duration>0?Number(el.duration):null;
    const position=Number.isFinite(el.currentTime)?Number(el.currentTime):null;
    const listened=Math.max(0,(state?.listenedMs||0)/1000);
    const completion=duration&&position!=null?Math.max(0,Math.min(100,(position/duration)*100)):null;
    return {
      ...meta,
      media_session_id:state?.id||'',
      listened_seconds:Number(listened.toFixed(2)),
      position_seconds:position==null?null:Number(position.toFixed(2)),
      duration_seconds:duration==null?null:Number(duration.toFixed(2)),
      completion_pct:completion==null?null:Number(completion.toFixed(2)),
      playback_rate:Number(el.playbackRate||1),
      muted:!!el.muted,
      volume:Number(el.volume),
      ...extra
    };
  }
  function beginMedia(el,reason='play'){
    trackedMedia.add(el);
    const meta=normalizeMediaMeta(el);
    const state={
      id:randomId('media'),
      key:mediaKey(meta),
      meta,
      active:true,
      activeSince:performance.now(),
      listenedMs:0,
      lastProgressAt:Date.now(),
      seekFrom:null
    };
    mediaStates.set(el,state);
    track(inferSurface(),'track_start',mediaData(el,state,{reason}));
    if(inferSurface()==='radio')track('radio','radio_play',mediaData(el,state,{reason}));
    return state;
  }
  function finalizeMedia(el,eventType,extra={},beacon=false){
    const state=mediaStates.get(el);
    if(!state)return;
    accumulateMedia(state);
    state.active=false;
    const payload=makePayload(inferSurface(),eventType,mediaData(el,state,extra));
    sendEvent(payload,{beacon});
    if(eventType==='track_complete'||eventType==='track_stop')mediaStates.delete(el);
  }
  function handlePlay(el){
    trackedMedia.add(el);
    const meta=normalizeMediaMeta(el);
    const state=mediaStates.get(el);
    if(!state||state.key!==mediaKey(meta)){
      if(state)finalizeMedia(el,'track_stop',{reason:'source_change'});
      beginMedia(el,'play');
      return;
    }
    if(!state.active){
      state.active=true;state.activeSince=performance.now();state.meta=meta;
      track(inferSurface(),'track_resume',mediaData(el,state,{reason:'resume'}));
      if(inferSurface()==='radio')track('radio','radio_play',mediaData(el,state,{reason:'resume'}));
    }
  }
  function handlePause(el){
    const state=mediaStates.get(el);
    if(!state||!state.active||el.ended)return;
    accumulateMedia(state);state.active=false;
    track(inferSurface(),'track_pause',mediaData(el,state,{reason:'pause'}));
    if(inferSurface()==='radio')track('radio','radio_pause',mediaData(el,state,{reason:'pause'}));
  }
  function handleEnded(el){
    finalizeMedia(el,'track_complete',{reason:'ended'});
  }
  function handleSeeking(el){
    const state=mediaStates.get(el);
    if(state)state.seekFrom=Number.isFinite(el.currentTime)?Number(el.currentTime):null;
  }
  function handleSeeked(el){
    const state=mediaStates.get(el);
    if(!state)return;
    track(inferSurface(),'track_seek',mediaData(el,state,{from_seconds:state.seekFrom,to_seconds:Number.isFinite(el.currentTime)?Number(el.currentTime):null}));
    state.seekFrom=null;
  }
  function setTrackMetadata(el,meta){
    if(!(el instanceof HTMLMediaElement))return false;
    const previous=mediaOverrides.get(el)||{};
    mediaOverrides.set(el,{...previous,...(meta||{})});
    const state=mediaStates.get(el);
    const nextMeta=normalizeMediaMeta(el);
    if(state&&state.key!==mediaKey(nextMeta)){
      const wasActive=state.active&&!el.paused;
      finalizeMedia(el,'track_complete',{reason:'metadata_change'});
      if(wasActive)beginMedia(el,'metadata_change');
    }else if(state){
      state.meta=nextMeta;state.key=mediaKey(nextMeta);
    }
    return true;
  }

  document.addEventListener('play',e=>{if(e.target instanceof HTMLMediaElement)handlePlay(e.target);},true);
  document.addEventListener('pause',e=>{if(e.target instanceof HTMLMediaElement)handlePause(e.target);},true);
  document.addEventListener('ended',e=>{if(e.target instanceof HTMLMediaElement)handleEnded(e.target);},true);
  document.addEventListener('seeking',e=>{if(e.target instanceof HTMLMediaElement)handleSeeking(e.target);},true);
  document.addEventListener('seeked',e=>{if(e.target instanceof HTMLMediaElement)handleSeeked(e.target);},true);

  setInterval(()=>{
    const now=Date.now();
    trackedMedia.forEach(el=>{
      const state=mediaStates.get(el);
      if(!state||!state.active||el.paused||el.ended)return;
      if(now-state.lastProgressAt<MEDIA_PROGRESS_MS)return;
      accumulateMedia(state);
      state.lastProgressAt=now;
      track(inferSurface(),'track_progress',mediaData(el,state,{reason:'heartbeat'}));
    });
  },10000);

  function localScores(){
    try{const v=JSON.parse(localStorage.getItem(SCORE_KEY)||'[]');return Array.isArray(v)?v:[];}catch(_e){return [];}
  }
  function rankScores(rows){
    return rows.slice().sort((a,b)=>{
      const at=Number(a.winningThrows)||Number.MAX_SAFE_INTEGER;
      const bt=Number(b.winningThrows)||Number.MAX_SAFE_INTEGER;
      return (at-bt)||(Number(b.score||0)-Number(a.score||0))||String(b.completedAt||'').localeCompare(String(a.completedAt||''));
    });
  }
  function cacheScores(rows){
    try{localStorage.setItem(SCORE_KEY,JSON.stringify(rankScores(rows).slice(0,250)));}catch(_e){}
  }
  async function postScore(record){
    if(!record||!record.id)return false;
    try{
      const r=await fetch(SCORE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,anon_id:anonId}),keepalive:true,credentials:'omit',cache:'no-store'});
      return r.ok;
    }catch(_e){return false;}
  }
  async function syncGameScores(){
    const local=localScores();
    let migrated=false;
    try{migrated=localStorage.getItem(SCORE_MIGRATION_KEY)==='1';}catch(_e){}
    if(!migrated&&local.length){
      let ok=true;
      for(const row of local.slice(0,100)){if(!(await postScore(row)))ok=false;}
      if(ok)try{localStorage.setItem(SCORE_MIGRATION_KEY,'1');}catch(_e){}
    }
    try{
      const r=await fetch(SCORE_URL+'?limit=250',{cache:'no-store',credentials:'omit'});
      if(!r.ok)return local;
      const d=await r.json();
      const remote=Array.isArray(d.items)?d.items:[];
      const map=new Map();
      remote.forEach(x=>{if(x&&x.id)map.set(String(x.id),x);});
      local.forEach(x=>{if(x&&x.id&&!map.has(String(x.id)))map.set(String(x.id),x);});
      const merged=rankScores([...map.values()]);
      cacheScores(merged);
      global.dispatchEvent(new CustomEvent('ge-vault-scores-updated',{detail:{count:merged.length}}));
      return merged;
    }catch(_e){return local;}
  }

  global.GE_SCORE_ENDPOINT=SCORE_URL;
  global.GEVault=Object.freeze({
    base:BASE,
    endpoint:EVENT_URL,
    eventUrl:EVENT_URL,
    scoreUrl:SCORE_URL,
    anonId,
    sessionId,
    acquisition,
    ownerUxEnabled:OWNER_UX_ENABLED,
    ownerUxFlush,
    track,
    trackExit,
    setTrackMetadata,
    postScore,
    syncGameScores,
    pageView:(surface='website',data={})=>track(surface,'page_view',data),
    radio:(eventType,data={})=>track('radio',eventType,data),
    website:(eventType,data={})=>track('website',eventType,data),
    ship:(eventType,data={})=>track('ship',eventType,data)
  });

  const surface=inferSurface();
  const baseline={visibility:document.visibilityState,title:document.title||'',device:deviceMeta()};
  track(surface,'session_start',{metadata:baseline});
  track(surface,'page_view',{metadata:baseline});
  if(surface==='radio')track('radio','radio_open',{metadata:baseline});

  if(location.pathname==='/qr'||location.pathname==='/qr/'){
    const touch=currentTouch();
    track('website','qr_scan',{
      campaign:touch.campaign||'main-sticker',
      qr_id:touch.qr_id||'',
      placement:touch.placement||'',
      variant:touch.variant||'',
      metadata:{device:deviceMeta()}
    });
  }

  global.addEventListener('pagehide',()=>{
    if(OWNER_UX_ENABLED)ownerUxFlush();
    trackedMedia.forEach(el=>{
      const state=mediaStates.get(el);
      if(state&&state.active)finalizeMedia(el,'track_stop',{reason:'pagehide'},true);
    });
    if(surface==='radio')sendEvent(makePayload('radio','radio_stop',{reason:'pagehide'}),{beacon:true});
    trackExit(surface,{metadata:{reason:'pagehide'}});
  },{once:true});

  // Observable interaction tracking. Never records form contents or typed text.
  document.addEventListener('click',e=>{
    const el=e.target&&e.target.closest?e.target.closest('button,a,[role="button"],[data-ge-event]'):null;
    if(!el)return;
    const explicit=el.getAttribute('data-ge-event');
    const id=(el.id||'').slice(0,100);
    const label=(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,120);
    if(OWNER_UX_ENABLED)ownerUxClick(el);
    if(explicit)track(surface,explicit,{id,label});
    if(el.matches('button,[role="button"]'))track(surface,'button_click',{id,label,control_type:el.tagName.toLowerCase()});
    if(id.toLowerCase().includes('share')||/\bshare\b/i.test(label))track(surface,'share_track',{control:id||label});
    if(el.tagName==='A'){
      try{
        const u=new URL(el.href,location.href);
        if(u.origin!==location.origin)track(surface,'external_link',{host:u.host,path:u.pathname,label});
      }catch(_e){}
    }
  },true);

  document.addEventListener('change',e=>{
    if(!OWNER_UX_ENABLED)return;
    const el=e.target;
    if(!el||!el.matches)return;
    if(el.matches('input[type="text"],input[type="password"],input[type="email"],textarea'))return;
    if(el.matches('input,select'))ownerUxBump('changes',ownerUxView()+' · '+ownerUxControl(el))
  },true);

  loadRightsCatalog().then(()=>{
    trackedMedia.forEach(el=>{
      const state=mediaStates.get(el);
      if(state)state.meta=applyRights(state.meta||normalizeMediaMeta(el));
    });
  }).catch(()=>{});
  syncGameScores().catch(()=>{});
})(window);
