/* GE Studios Vault Client
   Public browser helper. Contains NO secrets.
   Canonical endpoint: https://vault.grandelement.com/v1/public/event
*/
(function(global){
  'use strict';
  const ENDPOINT='https://vault.grandelement.com/v1/public/event';
  const ANON_KEY='GE_VAULT_ANON_V1';
  const SESSION_KEY='GE_VAULT_SESSION_V1';

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

  function base(surface){
    const u=new URL(location.href);
    return {
      anon_id:anonId,
      session_id:sessionId,
      surface:String(surface||'website').toLowerCase(),
      page_url:u.href,
      page_path:u.pathname,
      referrer:document.referrer||'',
      language:navigator.language||'',
      utm_source:u.searchParams.get('utm_source')||'',
      utm_medium:u.searchParams.get('utm_medium')||'',
      utm_campaign:u.searchParams.get('utm_campaign')||'',
      utm_content:u.searchParams.get('utm_content')||'',
      utm_term:u.searchParams.get('utm_term')||''
    };
  }

  function send(payload,{beacon=false}={}){
    const body=JSON.stringify(payload);
    try{
      if(beacon&&navigator.sendBeacon){
        return navigator.sendBeacon(ENDPOINT,new Blob([body],{type:'application/json'}));
      }
    }catch(_e){}
    return fetch(ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body,
      keepalive:true,
      credentials:'omit',
      cache:'no-store'
    }).catch(()=>null);
  }

  function track(surface,eventType,data={}){
    return send({...base(surface),...data,event_type:eventType});
  }

  function trackExit(surface,data={}){
    return send({...base(surface),...data,event_type:'session_end'},{beacon:true});
  }

  // AUTO BASELINE: every surface that loads this client gets durable page/session telemetry.
  try{
    const surface=location.pathname.startsWith('/radio')?'radio':'website';
    track(surface,'session_start',{metadata:{visibility:document.visibilityState}});
    track(surface,'page_view',{metadata:{title:document.title||''}});
    global.addEventListener('pagehide',()=>trackExit(surface,{metadata:{reason:'pagehide'}}),{once:true});
  }catch(_e){}

  global.GEVault=Object.freeze({
    endpoint:ENDPOINT,
    anonId,
    sessionId,
    track,
    trackExit,
    pageView:(surface='website',data={})=>track(surface,'page_view',data),
    radio:(eventType,data={})=>track('radio',eventType,data),
    website:(eventType,data={})=>track('website',eventType,data),
    ship:(eventType,data={})=>track('ship',eventType,data)
  });
})(window);
