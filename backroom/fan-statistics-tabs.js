/* Read-only Fan Vault summary tabs; no private credentials in this UI. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const states=$('brGeoStates'),geo=$('brGeoPanel');
 if(!states||!geo)return;
 const nav=document.createElement('nav');
 nav.id='brFanStatsTabs';nav.setAttribute('role','tablist');
 nav.setAttribute('aria-label','Filter the recorded fan statistics by category');
 const host=document.createElement('section');
 host.id='brFanStatsResults';host.hidden=true;host.setAttribute('role','tabpanel');
 host.setAttribute('aria-label','Fan activity statistics');
 const choices=[
  ['states','STATES'],['pages','PAGES'],['activity','ACTIVITY'],
  ['songs','SONGS'],['sources','SOURCES']
 ];
 const anchor=$('brGeoAllVisitors')||states;
 anchor.insertAdjacentElement('beforebegin',nav);
 states.insertAdjacentElement('afterend',host);
 let current='states',record=null;
 const allButton=$('brGeoAllVisitors');
 const number=n=>Number(n||0).toLocaleString();
 const mk=(tag,text)=>{
  const e=document.createElement(tag);e.textContent=String(text||'');return e;
 };
 function summaryRows(){
  if(!record)return [];
  if(current==='pages')return (record.pages||[]).map(r=>({
   label:r.page||'(unknown)',count:r.events,extra:number(r.visitors)+' visitor IDs',
   select:()=>{const select=$('brGeoPage');if(select){select.value=r.page||'ALL';select.dispatchEvent(new Event('change',{bubbles:true}))}}
  }));
  if(current==='activity')return [
   ...(record.event_types||[]).map(r=>({
    label:String(r.event_type||'unknown').replaceAll('_',' '),count:r.events,
    extra:number(r.visitors)+' visitor IDs',
    select:()=>{const select=$('brGeoEvent');if(select){select.value=r.event_type||'ALL';select.dispatchEvent(new Event('change',{bubbles:true}))}}
   })),
   ...(record.surfaces||[]).map(r=>({
    label:'AREA: '+String(r.surface||'unknown'),count:r.events,extra:number(r.visitors)+' visitor IDs'
   }))
  ];
  if(current==='songs')return (record.songs||[]).map(r=>({
   label:r.song||'(untitled song)',count:r.events,extra:number(r.visitors)+' visitor IDs'
  }));
  if(current==='sources')return [
   ...(record.referrer_hosts||[]).map(r=>({
    label:'REFERRER: '+r.host,count:r.events,extra:'Recorded arrival domain'
   })),
   ...(record.campaign_sources||[]).map(r=>({
    label:'CAMPAIGN: '+r.source,count:r.events,extra:'UTM source'
   }))
  ];
  return [];
 }
 function draw(){
  if(current==='states')return;
  host.replaceChildren();
  const heading=choices.find(([key])=>key===current)?.[1]||current;
  host.append(mk('h4',heading+' · RECORDED GE ACTIVITY'));
  if(current==='sources')host.append(mk('p','Only referral hostnames and campaign tags. No external browsing history.'));
  if(current==='pages')host.append(mk('p','Select a GE page to narrow the totals and visitor list.'));
  if(current==='activity')host.append(mk('p','Select a recorded event type to filter the other reports.'));
  const rows=summaryRows();
  if(!rows.length){host.append(mk('p','No matching recorded data for this category and time filter.'));return}
  const list=document.createElement('div');list.className='brFanStatsRows';
  for(const row of rows){
   const item=document.createElement(row.select?'button':'div');
   if(row.select)item.type='button';
   item.className='brFanStatsRow';
   const details=document.createElement('span');
   details.append(mk('strong',row.label),mk('small',row.extra||''));
   item.append(details,mk('b',number(row.count)));
   if(row.select)item.addEventListener('click',row.select);
   list.append(item);
  }
  host.append(list);
 }
 function setTab(mode){
  if(!choices.some(([id])=>id===mode))return;
  current=mode;
  if(mode!=='states')window.GE_BACKROOM_CLOSE_VISITOR_DRILLDOWN?.();
  for(const btn of nav.querySelectorAll('button[data-ge-stats]')){
   const selected=btn.dataset.geStats===mode;
   btn.setAttribute('aria-selected',String(selected));btn.tabIndex=selected?0:-1;
  }
  states.hidden=mode!=='states';
  if(allButton)allButton.hidden=mode!=='states';
  host.hidden=mode==='states';
  draw();
 }
 choices.forEach(([id,label])=>{
  const btn=mk('button',label);btn.type='button';
  btn.dataset.geStats=id;btn.setAttribute('role','tab');
  btn.setAttribute('aria-selected',String(id==='states'));
  btn.tabIndex=id==='states'?0:-1;
  btn.addEventListener('click',()=>setTab(id));
  btn.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
   event.preventDefault();
   const index=choices.findIndex(row=>row[0]===id);
   const next=choices[(index+(event.key==='ArrowRight'?1:-1)+choices.length)%choices.length][0];
   setTab(next);nav.querySelector('[data-ge-stats="'+next+'"]')?.focus();
  });
  nav.append(btn);
 });
 document.addEventListener('ge-backroom-fan-stats',event=>{
  record=event.detail||null;draw();
 });
 setTab('states');
})();
