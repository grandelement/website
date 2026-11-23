/* Owner-only Fan Vault visitor drilldown.
   Displays anonymous browser activity, not proof of real-world identity. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const panel=$('brGeoPanel'),regions=$('brGeoStates');
 if(!panel||!regions)return;
 const API='https://ge-backroom-publisher.grandelement.workers.dev';
 const SESSION='GE_BACKROOM_PUBLISH_SESSION_V1';
 const shell=document.createElement('section');
 shell.id='brGeoVisitorDrilldown';shell.hidden=true;
 shell.setAttribute('aria-label','Anonymous visitor activity and Fan Vault profiles');
 shell.style.cssText='padding:10px 0;border-top:1px solid #365c78;margin-top:12px';
 regions.insertAdjacentElement('afterend',shell);
 const allButton=document.createElement('button');
 allButton.type='button';allButton.id='brGeoAllVisitors';
 allButton.textContent='VIEW ALL VISITOR IDS';
 allButton.style.cssText='width:100%;min-height:46px;margin:8px 0';
 regions.insertAdjacentElement('beforebegin',allButton);
 let regionChoice=null,visitorId='',visitorRows=[],selectedFanId='',requestSerial=0;
 const button=(label,callback)=>{
  const el=document.createElement('button');el.type='button';el.textContent=label;
  el.style.cssText='min-height:44px;padding:9px;margin:4px 5px 6px 0';
  el.addEventListener('click',callback);return el;
 };
 const line=(tag,value)=>{
  const el=document.createElement(tag);el.textContent=String(value||'');return el;
 };
 const time=t=>{
  const value=Number(t);
  return Number.isFinite(value)&&value>0?new Date(value*1000).toLocaleString():'Time unavailable';
 };
 const shortId=id=>String(id||'').slice(-10);
 function currentPeriod(){return $('brGeoPeriod')?.value||'24h'}
 function hideDrilldown(){
  requestSerial++;regionChoice=null;visitorId='';selectedFanId='';
  shell.hidden=true;regions.hidden=false;allButton.hidden=false;
  shell.replaceChildren();
 }
 async function fetchOwner(path,body){
  const token=sessionStorage.getItem(SESSION);
  if(!token)throw Error('Sign in to Back Room first.');
  const response=await fetch(API+path,{
   method:body?'POST':'GET',cache:'no-store',
   headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw Error(result.error||'Vault HTTP '+response.status);
  return result;
 }
 function showLoading(message){
  shell.replaceChildren(line('p',message));shell.hidden=false;
  regions.hidden=true;allButton.hidden=true;
 }
 function backToRegions(){
  hideDrilldown();
  regions.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 function listControls(){
  const actions=document.createElement('div');
  actions.append(button('BACK TO ALL REGIONS',backToRegions));
  return actions;
 }
 function showVisitorList(){
  visitorId='';selectedFanId='';
  const title=regionChoice?.state&&regionChoice.state!=='ALL'
    ?regionChoice.state+' · '+(regionChoice.country||''):'ALL REGIONS';
  shell.replaceChildren(listControls(),line('h4','VISITOR IDS · '+title),
   line('p','Anonymous browser IDs only. A saved label does not verify a person.'));
  if(!visitorRows.length){shell.append(line('p','No visitor IDs match these filters.'));return}
  for(const row of visitorRows){
   const id=String(row.anon_id||'');if(!id)continue;
   const control=button('',()=>void openVisitor(id));
   control.className='brGeoVisitorRow';
   control.style.cssText='display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;text-align:left;border:1px solid #466985;margin:5px 0;padding:12px;min-height:55px';
   const name=row.fan_name?String(row.fan_name):'VISITOR '+shortId(id);
   control.append(line('strong',name),line('span',Number(row.events||0)+' events · '+
     Number(row.sessions||0)+' sessions · Last '+time(row.last_activity)));
   control.append(line('small',(row.fan_id?'SAVED FAN PROFILE':'UNLABELED VISITOR')+
     ' · '+String(row.region||'Unknown')+', '+String(row.country||'Unknown')));
   shell.append(control);
  }
 }
 async function openRegion(choice){
  regionChoice={state:String(choice?.state||'ALL'),country:String(choice?.country||'ALL')};
  visitorId='';visitorRows=[];
  const serial=++requestSerial;
  showLoading('READING VISITORS FROM GE VAULT…');
  const q=new URLSearchParams({period:currentPeriod(),country:'ALL',state:regionChoice.state,
   event:$('brGeoEvent')?.value||'ALL'});
  const country=regionChoice.country.toUpperCase();
  if(regionChoice.state!=='ALL'&&['US','USA','UNITED STATES'].includes(country))q.set('country','US');
  try{
   const data=await fetchOwner('/manage/fan-visitors?'+q.toString());
   if(serial!==requestSerial)return;
   visitorRows=Array.isArray(data.visitors)?data.visitors:[];
   showVisitorList();
  }catch(error){
   if(serial!==requestSerial)return;
   shell.replaceChildren(listControls(),line('p','VISITORS NOT LOADED · '+String(error.message||error)));
  }
 }
 async function openVisitor(id){
  if(!id)return;
  visitorId=id;
  const serial=++requestSerial;
  showLoading('READING RECORDED ACTIVITY FOR VISITOR '+shortId(id)+'…');
  try{
   const q=new URLSearchParams({period:currentPeriod(),anon_id:id});
   const data=await fetchOwner('/manage/fan-visitors?'+q.toString());
   if(serial!==requestSerial)return;
   const events=Array.isArray(data.events)?data.events:[];
   selectedFanId=String(data.fan_id||'');
   const top=document.createElement('div');
   top.append(button('BACK TO VISITOR LIST',showVisitorList),button('ALL REGIONS',backToRegions));
   shell.replaceChildren(top,line('h4','VISITOR '+shortId(id)),
    line('p','Recorded activity for one anonymous browser ID · '+events.length+' events in '+currentPeriod()+
      (data.has_more?' · First 300 shown':'')+'. This does not verify identity.'));
   const status=line('p','');
   status.id='brGeoVisitorActionStatus';status.setAttribute('role','status');
   const controls=document.createElement('section');
   controls.id='brGeoVisitorFanControls';
   if(selectedFanId){
    controls.append(line('p','SAVED FAN · '+String(data.fan_name||selectedFanId)),
      button('OPEN SAVED FAN PROFILE',()=>void openSavedFan(selectedFanId,status)));
   }else{
    const label=line('label','OWNER FAN LABEL');
    const input=document.createElement('input');
    input.id='brGeoVisitorFanName';input.type='text';input.maxLength=80;
    input.value='Visitor '+shortId(id);
    input.autocomplete='off';
    input.setAttribute('aria-label','Owner label for anonymous visitor');
    input.style.cssText='display:block;width:100%;max-width:400px;min-height:42px;margin:6px 0 8px';
    label.append(input);
    const add=button('ADD TO SAVED FANS',()=>void addToFans(id,input,add,status));
    add.id='brGeoVisitorAddFan';
    controls.append(label,add,line('p','Owner label only. No personal identity or consent is inferred.'));
   }
   shell.append(controls,status,line('h4','ACTIVITY HISTORY'));
   const history=document.createElement('div');
   history.id='brGeoVisitorEvents';
   history.style.cssText='max-height:55vh;overflow-y:auto;border-top:1px solid #365b7d';
   if(!events.length)history.append(line('p','No events found for this visitor in the selected time range.'));
   for(const event of events){
    const item=document.createElement('article');
    item.style.cssText='padding:10px 3px;border-bottom:1px solid #365b7d';
    const label=String(event.event_type||'activity').replaceAll('_',' ').toUpperCase();
    item.append(line('strong',label),line('div',time(event.occurred_at)));
    const details=[
     event.page_path?'PAGE · '+event.page_path:'',
     event.track_title?'SONG · '+event.track_title:'',
     event.album?'ALBUM · '+event.album:'',
     event.playlist_id?'PLAYLIST · '+event.playlist_id:'',
     event.share_target?'SHARE · '+event.share_target:'',
     event.surface?'AREA · '+event.surface:''
    ].filter(Boolean);
    for(const value of details)item.append(line('div',value));
    history.append(item);
   }
   shell.append(history);
  }catch(error){
   if(serial!==requestSerial)return;
   shell.replaceChildren(button('BACK TO VISITOR LIST',showVisitorList),
    line('p','ACTIVITY NOT LOADED · '+String(error.message||error)));
  }
 }
 async function addToFans(id,input,control,status){
  const name=input.value.trim();
  if(!name){status.textContent='ENTER A FAN LABEL FIRST.';input.focus();return}
  if(!confirm('Save this anonymous browser ID as "'+name+'" in GE Fan Vault? The label does not verify a person.'))return;
  control.disabled=true;status.textContent='SAVING FAN PROFILE IN GE VAULT…';
  try{
   const data=await fetchOwner('/manage/fan-access',{
    action:'label',anon_id:id,display_name:name
   });
   selectedFanId=String(data.fan_id||'');
   status.textContent='SAVED FAN PROFILE · '+selectedFanId;
   await openVisitor(id);
   const panel=$('brCodeFansPanel');
   if(panel){panel.open=true;panel.dispatchEvent(new Event('toggle')); }
  }catch(error){status.textContent='FAN NOT SAVED · '+String(error.message||error)}
  finally{control.disabled=false}
 }
 async function openSavedFan(id,status){
  if(typeof window.GE_BACKROOM_OPEN_FAN_PROFILE==='function'){
   const opened=await window.GE_BACKROOM_OPEN_FAN_PROFILE(id);
   if(opened){status.textContent='SAVED FAN PROFILE OPENED BELOW.';return}
  }
  status.textContent='Saved Fan panel is unavailable. Open FANS · GE VAULT PROFILES and refresh the list.';
 }
 allButton.addEventListener('click',()=>void openRegion({state:'ALL',country:'ALL'}));
 window.GE_BACKROOM_OPEN_REGION_VISITORS=choice=>void openRegion(choice);
 for(const id of ['brGeoRefresh','brGeoPeriod','brGeoCountry','brGeoState','brGeoEvent']){
  const control=$(id);if(!control)continue;
  control.addEventListener(id==='brGeoRefresh'?'click':'change',hideDrilldown);
 }
})();
