/* GE VAULT · tap-to-filter analytics tiles, v1
 * Uses the existing authenticated /control/vault/analytics response.
 * No tracking, new permissions, new requests, or inferred identities.
 */
(function(){
'use strict';
if(typeof renderAnalytics!=='function'||!document.getElementById('analyticsStats'))return;
var keys=['unique','identified','anonymous','sessions','events','actions','page_views',
 'radio_opens','station_performances','song_listening','qr_scans','game_completions','countries','cities'];
var names=['UNIQUE FANS','IDENTIFIED','ANONYMOUS','SESSIONS','EVENTS','ACTIONS','PAGE VIEWS',
 'RADIO OPENS','STATION PLAYS','SONG LISTENING','QR SCANS','GAME FINISHES','COUNTRIES','CITIES'];
var selected='',place='',placeKind='';
var stats=document.getElementById('analyticsStats'),panel=document.getElementById('analyticsMetricDetail');
var header=document.getElementById('analyticsFansHeading');
if(!panel||!header)return;
function clean(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function number(v){return Math.max(0,Number(v)||0)}
function amount(f,key){
 if(key==='unique')return 1;
 if(key==='identified')return f.identified?1:0;
 if(key==='anonymous')return f.identified?0:1;
 if(key==='song_listening')return number(f.listened_seconds);
 if(key==='actions'){
  return (Array.isArray(f.event_types)?f.event_types:[]).reduce(function(a,x){
   return a+(['button_click','control_change','form_submit','internal_link','external_link'].indexOf(x.name)>=0?number(x.count):0);
  },0);
 }
 if(key==='countries')return String(f.country||'').trim()?1:0;
 if(key==='cities')return String(f.city||'').trim()?1:0;
 return number(f[key]);
}
function isPersonPlace(f){
 if(!place)return true;
 if(placeKind==='countries')return String(f.country||'').toLowerCase()===place.toLowerCase();
 if(placeKind==='cities'){
  var pair=[f.region,f.city].filter(Boolean).join(' / ').toLowerCase();
  return pair===place.toLowerCase()||String(f.city||'').toLowerCase()===place.toLowerCase();
 }
 return true;
}
function matching(d){
 var rows=Array.isArray(d&&d.fans)?d.fans:[];
 if(!selected)return rows;
 if(selected==='station_performances')return [];
 rows=rows.filter(function(f){return amount(f,selected)>0&&isPersonPlace(f)});
 if(['unique','identified','anonymous','countries','cities'].indexOf(selected)<0){
  rows.sort(function(a,b){return amount(b,selected)-amount(a,selected)||number(b.last_seen_at)-number(a.last_seen_at)});
 }
 return rows;
}
function filtered(rows){
 return typeof analyticsFilterFans==='function'?analyticsFilterFans(rows):rows;
}
function fanName(f){
 var name=String(f.display_name||'').trim();
 var id=String(f.anon_id||'').replace(/^visitor-/,'').slice(0,12)||'unknown';
 return name?name+(f.identified?'':' (private label)'):'Fan '+id+' · '+(f.identified?'identified':'anonymous');
}
function duration(sec){return typeof analyticsFmtSeconds==='function'?analyticsFmtSeconds(sec):String(sec||0)+'s'}
function timestamp(t){return t&&typeof analyticsFmtTime==='function'?analyticsFmtTime(t):''}
function metricTotal(d){
 var t=d&&d.totals||{};
 var map={unique:t.unique_visitors,identified:t.identified_fans,anonymous:t.anonymous_fans,
  sessions:t.sessions,events:t.events,actions:t.interaction_actions,page_views:t.page_views,
  radio_opens:t.radio_opens,station_performances:t.station_performances,
  song_listening:duration(t.total_listened_seconds||0),qr_scans:t.qr_scans,
  game_completions:t.game_completions,countries:t.countries,cities:t.cities};
 return map[selected]==null?0:map[selected];
}
function metricNote(){
 if(selected==='unique')return 'All available visitor IDs in this date range. A name is shown only if it is linked or privately labeled.';
 if(selected==='identified')return 'Visitors with linked profiles. Not all identified accounts have provided a name.';
 if(selected==='anonymous')return 'Anonymous IDs are not verified real-world identities. Private nicknames are not proof of identity.';
 if(selected==='station_performances')return 'Station plays are server-side song broadcasts, NOT plays by individually identified fans. These records cannot show who heard a broadcast.';
 if(selected==='countries'||selected==='cities')return 'Location totals count recorded events, not individual people. Tap a place to see visitor IDs whose latest reported location matches.';
 if(selected==='song_listening')return 'Combined recorded song-listening time. Unattributed listening cannot identify a person.';
 return 'This total counts '+(selected==='sessions'?'separate sessions':'recorded activity')+', not unique people. Below are visitor IDs with matching activity.';
}
function metricLabel(){var i=keys.indexOf(selected);return names[i]||selected}
function drawFanRows(list,d){
 var tbody=document.getElementById('analyticsFans');
 var rows=typeof analyticsSortRows==='function'?analyticsSortRows(filtered(list),'fans'):filtered(list);
 tbody.innerHTML=rows.slice(0,500).map(function(x){
  var loc=[x.city,x.region,x.country].filter(Boolean).join(', ')||'—';
  var anon=String(x.anon_id||''),nick=String(x.display_name||'').trim(),id=anon.replace(/^visitor-/,'').slice(0,12);
  return '<tr class="fanRow" data-anon="'+clean(anon)+'"><td>'+clean(nick||('Fan '+id))+
    (x.identified?'<span class="fanSub fanIdentified">IDENTIFIED</span>':
     '<span class="fanSub">ANONYMOUS'+(nick?' · private label':'')+'</span>')+
    '</td><td>'+clean(timestamp(x.last_seen_at))+'</td><td>'+clean(loc)+'</td><td>'+number(x.sessions)+
    '</td><td>'+number(x.events)+'</td><td>'+number(x.unique_tracks)+'</td><td>'+clean(duration(x.listened_seconds))+
    '</td><td>'+clean(x.campaign||'—')+'</td></tr>';
 }).join('')||'<tr><td colspan="8" class="note">'+(selected==='station_performances'?
  'Broadcast records do not identify listeners. See the Station Performance Log below.':
  'No visitor IDs match this statistic and your search.')+'</td></tr>';
}
function draw(d){
 var tiles=stats.children;
 for(var i=0;i<tiles.length&&i<keys.length;i++){
  var tile=tiles[i];
  tile.setAttribute('role','button');tile.tabIndex=0;
  tile.setAttribute('data-vault-metric',keys[i]);
  tile.setAttribute('aria-label','Show '+names[i]+' details');
  tile.setAttribute('aria-pressed',selected===keys[i]?'true':'false');
  tile.classList.add('analyticsStatButton');
  tile.classList.toggle('selected',selected===keys[i]);
 }
 if(!selected){panel.innerHTML='';header.textContent='INDIVIDUAL FANS · TAP A ROW FOR FULL HISTORY';return}
 var who=filtered(matching(d));
 var h='<div class="analyticsMetricHead"><h3>'+clean(metricLabel())+' · '+clean(metricTotal(d))+
   '</h3><button type="button" class="analyticsMetricClear" data-vault-clear="1">CLEAR FILTER</button></div>'+
   '<p class="analyticsMetricNote">'+clean(metricNote())+'</p>';
 if(selected==='station_performances'){
  var tracks=Array.isArray(d&&d.station_music)?d.station_music:[];
  h+='<div class="analyticsMetricList">'+tracks.slice(0,150).map(function(x){
   return '<div class="analyticsMetricItem"><div><b>'+clean(x.track_title||x.track_id||'Untitled')+
     '</b><span>'+clean(x.album||'')+'</span></div><strong class="analyticsMetricAmount">'+number(x.performances)+' plays</strong></div>';
  }).join('')+'</div>';
  if(!tracks.length)h+='<p class="analyticsMetricNote">No station records in this selected date range.</p>';
 }else if((selected==='countries'||selected==='cities')&&!place){
  var g=d&&d.geography||{},locations=Array.isArray(g[selected])?g[selected]:[];
  h+='<div class="analyticsMetricList">'+locations.map(function(x){
   return '<button type="button" class="analyticsMetricItem" data-vault-place="'+clean(x.name||'')+'"><div><b>'+
     clean(x.name||'Unknown')+'</b><span>Tap for matching visitors</span></div><strong class="analyticsMetricAmount">'+
     number(x.count)+' events</strong></button>';
  }).join('')+'</div>';
  if(!locations.length)h+='<p class="analyticsMetricNote">No location information recorded.</p>';
 }else{
  if(place)h+='<p class="analyticsMetricNote">LOCATION · '+clean(place)+' · <button type="button" data-vault-places="1" class="analyticsMetricClear">ALL LOCATIONS</button></p>';
  h+='<p class="analyticsMetricNote">'+who.length+' matching visitor ID'+(who.length===1?'':'s')+
     '. Tap a name or ID to view its full history.</p>';
  h+='<div class="analyticsMetricList">'+who.slice(0,150).map(function(f){
   var m=amount(f,selected);
   var val=selected==='song_listening'?duration(m):selected==='unique'||selected==='identified'||selected==='anonymous'?number(f.events)+' events':
    selected==='countries'||selected==='cities'?'visitor':
    String(m)+(selected==='sessions'?' sessions':'');
   return '<button type="button" class="analyticsMetricItem" data-vault-fan="'+clean(f.anon_id)+'"><div><b>'+
     clean(fanName(f))+'</b><span>'+clean([f.city,f.country].filter(Boolean).join(', ')||'Location unknown')+
     ' · '+clean(timestamp(f.last_seen_at))+'</span></div><strong class="analyticsMetricAmount">'+clean(val)+'</strong></button>';
  }).join('')+'</div>';
  if(who.length>150)h+='<p class="analyticsMetricNote">Showing first 150 of '+who.length+
    ' matching visitors. See the table farther down for up to 500.</p>';
  if(!who.length)h+='<p class="analyticsMetricNote">No matching visitor IDs. Some totals include unattributed events.</p>';
 }
 panel.innerHTML=h;
 var line=selected==='station_performances'?' · BROADCASTS DO NOT IDENTIFY FANS':
   ' · '+metricLabel()+(place?' / '+place:'')+' · '+who.length+' IDs';
 header.textContent='INDIVIDUAL FANS'+line+' · TAP A ROW FOR HISTORY';
 if(selected==='station_performances')drawFanRows([],d);
 else if((selected==='cities'||selected==='countries')&&!place)drawFanRows(matching(d),d);
 else drawFanRows(matching(d),d);
}
var original=renderAnalytics;
renderAnalytics=function(data){
 original(data);
 draw(data||{});
};
function refresh(){if(typeof analyticsData!=='undefined'&&analyticsData)renderAnalytics(analyticsData)}
function activate(metric){
 selected=selected===metric?'':metric;place='';placeKind='';
 refresh();
 if(selected&&panel.scrollIntoView)try{panel.scrollIntoView({behavior:'smooth',block:'nearest'})}catch(ignore){}
}
stats.addEventListener('click',function(event){
 var tile=event.target.closest('[data-vault-metric]');
 if(tile&&stats.contains(tile))activate(tile.getAttribute('data-vault-metric'));
});
stats.addEventListener('keydown',function(event){
 if(event.key!=='Enter'&&event.key!==' ')return;
 var tile=event.target.closest('[data-vault-metric]');
 if(!tile||!stats.contains(tile))return;
 event.preventDefault();activate(tile.getAttribute('data-vault-metric'));
});
panel.addEventListener('click',function(event){
 if(event.target.closest('[data-vault-clear]')){selected='';place='';placeKind='';refresh();return}
 if(event.target.closest('[data-vault-places]')){place='';placeKind='';refresh();return}
 var location=event.target.closest('[data-vault-place]');
 if(location){place=location.getAttribute('data-vault-place')||'';placeKind=selected;refresh();return}
 var fan=event.target.closest('[data-vault-fan]');
 if(fan){
  var id=fan.getAttribute('data-vault-fan')||'';
  if(!id)return;
  Promise.resolve(loadFanDetail(id)).then(function(){
   var box=document.getElementById('analyticsFanDetail');
   if(box&&box.classList.contains('show')&&box.scrollIntoView)try{
    box.scrollIntoView({behavior:'smooth',block:'nearest'})
   }catch(ignore){}
  });
 }
});
})();