/* GE Back Room single SAVE control. Each action goes to its existing
   authenticated source. Never silently publish a DJ/on-air queue from
   a general GitHub save and never report success before source readback. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const button=$('brTopSave'),display=$('brCentralSaveStatus');
 if(!button||!display)return;
 let busy=false;
 const tab=()=>document.querySelector('#backroomTabs button[data-tab][aria-selected="true"]')?.dataset.tab||'radio';
 const show=(message,kind='info')=>{
   display.hidden=false;display.dataset.kind=kind;display.textContent=message;
 };
 const trigger=(id,label,source,statusId)=>{
   const target=$(id);
   if(!target){show(label+' is not connected to its original save handler. Nothing was saved.','error');return false;}
   if(target.disabled){show(label+' is busy or needs a connection. Nothing was saved.','error');return false;}
   show('SAVE REQUESTED · '+label+' → '+source+'. Check confirmation below before leaving this screen.');
   const status=$(statusId);
   // Capture status events from the original record-specific publisher. Never
   // replace a refusal or pending write with a fake global success message.
   let observer=null,alive=true;
   if(status){
     const original=status.textContent;
     observer=new MutationObserver(()=>{
       const content=(status.textContent||'').trim();
       if(!alive||!content||content===original)return;
       const failed=/NOT SAVED|FAILED|UNAVAILABLE|ERROR|BLOCKED|REFUS|SIGN.IN|NEEDS|CANCELLED|NOT VERIFIED|NO GITHUB/i.test(content);
       const success=/PUBLISHED|SAVED|VERIFIED|UPDATED/i.test(content)&&!failed;
       if(failed||success){
         show((success?'CONFIRMED · ':'NOT SAVED · ')+label+' · '+content,failed?'error':'success');
         observer.disconnect();alive=false;
       }
     });
     observer.observe(status,{childList:true,subtree:true,characterData:true});
     setTimeout(()=>{observer?.disconnect();alive=false},45000);
   }
   target.click();
   return true;
 };
 const watchFanResult=()=>{
   const status=$('brFanVaultSaveStatus');
   if(!status)return;
   const observer=new MutationObserver(()=>{
     const content=(status.textContent||'').trim();
     if(!/SAVED IN GE VAULT|NEW FAN PROFILE SAVED IN GE VAULT|NOT SAVED|FAN PROFILE NOT SAVED|NOT VERIFIED/i.test(content))return;
     const failed=/NOT SAVED|NOT VERIFIED/i.test(content);
     show((failed?'NOT SAVED · ':'VAULT VERIFIED · ')+content,failed?'error':'success');
     observer.disconnect();
   });
   observer.observe(status,{childList:true,subtree:true,characterData:true});
   setTimeout(()=>observer.disconnect(),45000);
 };
 const selectedSave=()=>{
   const current=tab();
   if(['welcome','about','universe','games','moon','gate'].includes(current)){
     if(typeof window.GE_BACKROOM_SAVE_PUBLIC_SETTINGS!=='function'){
       show('Website GitHub publisher did not initialize. Nothing saved.','error');return;
     }
     if(busy)return;
     busy=true;button.disabled=true;
     show('CHECKING WEBSITE CHANGES BEFORE GITHUB SAVE…');
     Promise.resolve(window.GE_BACKROOM_SAVE_PUBLIC_SETTINGS()).then(result=>{
       if(result?.cancelled)show('SAVE CANCELLED · No settings changed.');
       else if(result?.unchanged)show('ALREADY SAVED · Website settings match the loaded GitHub version.','success');
       else if(result?.ok)show('GITHUB VERIFIED · '+result.commit.slice(0,12)+' · '+result.paths.join(', ').toUpperCase()+
         '. No private Vault records or live DJ queue changed.','success');
     }).catch(error=>show('NOT SAVED · '+String(error.message||error),'error'))
       .finally(()=>{busy=false;button.disabled=false});
     return;
   }
   if(current==='radio'){
     // The front/store/player/radio checkbox matrix is the default Radio job.
     // The existing advanced disclosures explicitly select a different save.
     if($('brRadioPlaylistTools')?.open)
       return trigger('brPlaylistSave','GE PLAYLIST','GITHUB','brPlaylistStatus');
     if($('brMusicRadioMaster')?.open)
       return trigger('brMasterSave','MASTER SONG APPROVALS','GITHUB','brMasterStatus');
     if($('brRouteAdvancedPlayer')?.open)
       return trigger('brPublicPlayerSave','PUBLIC PLAYER PROFILE','GITHUB','brPublicPlayerStatus');
     return trigger('brRouteSave','FRONT / STORE / PLAYER / RADIO MUSIC','GITHUB','brRouteStatus');
   }
   if(current==='access'){
     if($('brAccessEditor')?.hidden){
       show('CHOOSE OR CREATE AN ACCESS CODE FIRST. Review the permissions, then press SAVE. No code was issued.','error');
       return;
     }
     const existing=$('brAccessSave')&&!$('brAccessSave').hidden;
     return trigger(existing?'brAccessSave':'brAccessIssue',
       existing?'ACCESS CODE CHANGES':'NEW ACCESS CODE','PRIVATE VAULT','brAccessStatus');
   }
   if(current==='fans'){
     const profile=$('brFanActiveProfile');
     const panel=$('brCodeFansPanel');
     if(!panel?.open){panel?.setAttribute('open','');show('OPEN FANS, load a profile or enter a new fan name, then press SAVE.','error');return;}
     const allButtons=[...panel.querySelectorAll('button')];
     const fanAction=(label)=>allButtons.find(x=>x.textContent.trim()===label&&!x.disabled);
     if(profile&&!profile.hidden){
       const target=fanAction('SAVE FAN CODE');
       if(!target){show('No loaded fan code save control. Nothing saved.','error');return}
       if(!confirm('Save this fan’s selected access-code assignment to PRIVATE VAULT?'))return;
       show('SAVING FAN CODE LINK TO PRIVATE VAULT…');watchFanResult();target.click();return;
     }
     const name=$('brFanProfileSearch')?.value.trim()||'';
     if(name){
       const target=fanAction('NEW / SAVE');
       if(!target){show('New fan profile control unavailable. Nothing saved.','error');return}
       if(!confirm('Create a new PRIVATE VAULT fan profile named "'+name.slice(0,80)+'"?'))return;
       show('CREATING FAN IN PRIVATE VAULT…');watchFanResult();target.click();return;
     }
     show('CHOOSE AN EXISTING FAN OR ENTER A NEW NAME BEFORE SAVING. No records changed.','error');
     return;
   }
   show('This section has no editable record to save. Select RADIO, ACCESS CODES, FANS or a website setting.','error');
 };
 button.addEventListener('click',selectedSave);
 window.GE_BACKROOM_SAVE_ACTIVE=selectedSave;
})();
