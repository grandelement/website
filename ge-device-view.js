/* One shared device-view contract on Home and Radio.
   Automatic detection uses physical touch-screen hardware, not Safari's
   changeable desktop user-agent or a CSS layout viewport enlarged by Safari.
   An explicit GE view choice is stored per browser for both pages. */
(()=>{
  const KEY='GE_DEVICE_VIEW_PREFERENCE_V1';
  const ua=String(navigator.userAgent||'');
  const mobileUA=/iPhone|iPad|iPod|Android|Mobile|Tablet/i.test(ua);
  const macUA=/Macintosh/i.test(ua)&&!/iPhone|iPod/i.test(ua);
  const touch=Number(navigator.maxTouchPoints||0)>0;
  const shortSide=Math.min(Number(screen.width)||9999,Number(screen.height)||9999);
  const phoneHardware=shortSide<=600&&(mobileUA||macUA&&touch||typeof navigator.standalone==='boolean');
  const tabletHardware=touch&&macUA&&shortSide<=1100;
  const desktopUA=/Windows NT|Macintosh|X11|CrOS|Linux x86_64/i.test(ua);
  let preference='auto';
  try{
    const query=new URLSearchParams(location.search).get('ge_view');
    if(query==='mobile'||query==='desktop'||query==='auto'){
      preference=query;
      localStorage.setItem(KEY,query);
    }else{
      const saved=localStorage.getItem(KEY);
      if(saved==='mobile'||saved==='desktop')preference=saved;
    }
  }catch(_){}
  const layout=preference==='auto'?
    (phoneHardware||tabletHardware||mobileUA?'mobile':desktopUA?'desktop':'mobile'):preference;
  const html=document.documentElement;
  html.dataset.geDeviceLayout=layout;
  html.dataset.geDevicePreference=preference;
  html.classList.toggle('ge-mobile-device',layout==='mobile');
  html.classList.toggle('ge-desktop-device',layout==='desktop');
  // Virtual desktop rendering is an OPT-IN, never a Safari user-agent guess.
  const requestedDesktop=preference==='desktop'&&(phoneHardware||tabletHardware);
  html.classList.toggle('ge-safari-desktop-request',requestedDesktop);
  const viewport=document.querySelector('meta[name="viewport"]');
  function applyViewport(){
    if(!viewport)return;
    // Keep one orientation-independent viewport. Safari owns device-width
    // throughout rotation; never freeze the previous physical screen width.
    const value=requestedDesktop?'width=1160,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover':'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
    if(viewport.content!==value)viewport.content=value;
  }
  applyViewport();
  window.GEDeviceView={
    get mode(){return html.dataset.geDeviceLayout},
    get preference(){return html.dataset.geDevicePreference},
    setPreference(next){
      if(!['auto','mobile','desktop'].includes(next))return false;
      try{localStorage.setItem(KEY,next)}catch(_){}
      const url=new URL(location.href);
      url.searchParams.set('ge_view',next);
      location.assign(url.href);
      return true;
    }
  };
})();
