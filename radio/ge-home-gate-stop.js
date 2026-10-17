/* GE Gate applies to every Grand Element website player, not to BLITZ. */
(function(){
  'use strict';
  const STATE='GE_GATE_STATE_V5_3333';
  const authorized=()=>{
    try{return localStorage.getItem('GE_GATE_LOVE_V1')==='1'||
      localStorage.getItem('GE_PLAYER_OWNER_DEMO_V1')==='yes';}
    catch(_e){return false;}
  };
  function locked(){
    if(authorized())return false;
    try{
      const state=JSON.parse(localStorage.getItem(STATE)||'null');
      if(!state)return false;
      return !!state.expired||
        !!(state.active&&Number(state.expireAt)>0&&Date.now()>=Number(state.expireAt));
    }catch(_e){return false;}
  }
  function stopMedia(media){
    try{media.muted=true;media.defaultMuted=true;media.pause();}catch(_e){}
  }
  function enforce(){
    if(!locked())return;
    document.querySelectorAll('audio,video').forEach(stopMedia);
    try{window.GE_MUSIC_CONTROLLER?.stop?.();}catch(_e){}
  }
  document.addEventListener('play',event=>{
    if(locked())stopMedia(event.target);
  },true);
  window.addEventListener('storage',event=>{
    if([STATE,'GE_GATE_LOVE_V1','GE_PLAYER_OWNER_DEMO_V1'].includes(event.key))enforce();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)enforce()});
  window.addEventListener('pageshow',enforce);
  setInterval(enforce,1000);
  enforce();
})();
