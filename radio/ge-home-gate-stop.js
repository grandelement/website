/* GE Gate applies to every Grand Element website player, not to BLITZ. */
(function(){
  'use strict';
  const STATE='GE_GATE_STATE_V5_3333';
  const SCOPED_SESSION='GE_VAULT_SCOPED_ACCESS_V1';
  const silenced=new Map();
  const authorized=()=>{
    try{
      // The Radio Gate accepts every active Back Room code through Vault.
      // Its shared receipt may unlock homepage players only for the matching
      // website/music/album permissions, never for Radio-only or Game-only.
      const receipt=JSON.parse(sessionStorage.getItem(SCOPED_SESSION)||'null');
      if(receipt&&Number(receipt.until)>Date.now()&&Array.isArray(receipt.scopes)&&
        receipt.scopes.some(scope=>['website','music','albums'].includes(scope)))return true;
      // Private device-only owner preview; never a public listener credential.
      return localStorage.getItem('GE_PLAYER_OWNER_DEMO_V1')==='yes';
    }catch(_e){return false;}
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
    try{
      if(!silenced.has(media))silenced.set(media,{muted:media.muted,defaultMuted:media.defaultMuted});
      media.muted=true;media.defaultMuted=true;media.pause();
    }catch(_e){}
  }
  function enforce(){
    if(!locked()){
      // Restore the prior mute setting only for media this Gate silenced.
      // Never start playing automatically after a code unlock.
      for(const [media,previous] of silenced){
        try{media.muted=previous.muted;media.defaultMuted=previous.defaultMuted;}catch(_e){}
      }
      silenced.clear();
      return;
    }
    document.querySelectorAll('audio,video').forEach(stopMedia);
    try{window.GE_MUSIC_CONTROLLER?.stop?.();}catch(_e){}
  }
  document.addEventListener('play',event=>{
    if(locked())stopMedia(event.target);
  },true);
  window.addEventListener('storage',event=>{
    if([STATE,SCOPED_SESSION,'GE_PLAYER_OWNER_DEMO_V1'].includes(event.key))enforce();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)enforce()});
  window.addEventListener('pageshow',enforce);
  setInterval(enforce,1000);
  enforce();
})();
