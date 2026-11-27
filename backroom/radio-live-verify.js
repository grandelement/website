/* GE Studios Backroom Radio Source Verification.
 * Radio 1: authenticated BLITZ status with public Icecast health and metadata.
 * Radio 2: shared Cloudflare schedule (prediction, not proof of audible output).
 * GitHub: independently read published playlist source. No Blitz build is needed.
 */
(function(){
  'use strict';
  var root=document.getElementById('brRadioStationStatus');
  if(!root)return;
  var section=document.createElement('section');
  section.id='brIndependentRadioVerify';
  section.setAttribute('aria-label','Current songs and playlist verification');
  section.innerHTML=
    '<style>'+
    '#brIndependentRadioVerify{border:1px solid #568ca6;border-radius:12px;background:#041523;padding:10px;margin:10px 0}'+
    '#brIndependentRadioVerify .geVerifyGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:9px;margin:9px 0}'+
    '#brIndependentRadioVerify .geVerifyCard{padding:10px;border-radius:10px;background:#0a2940;border:1px solid #315e78;min-width:0}'+
    '#brIndependentRadioVerify .geVerifyCard strong{display:block;font-size:13px;color:#a9e7ff}'+
    '#brIndependentRadioVerify .geVerifyCard b{display:block;font-size:17px;color:white;overflow-wrap:anywhere;margin:6px 0}'+
    '#brIndependentRadioVerify .geVerifyCard p{font-size:12px;line-height:1.4;overflow-wrap:anywhere;margin:5px 0}'+
    '#brIndependentRadioVerify button{min-height:43px;margin:4px 0}'+
    '#brIndependentRadioVerify audio{width:100%;min-height:40px;margin-top:6px}'+
    '#brIndependentRadioVerify .geVerifyNote{font-size:12px;color:#c5dce7;margin:6px 0}'+
    '</style>'+
    '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">'+
    '<strong>NOW PLAYING · SOURCE VERIFICATION</strong>'+
    '<button id="brVerifyRefresh" type="button">REFRESH LIVE STATUS</button></div>'+
    '<div class="geVerifyGrid">'+
    '<div class="geVerifyCard"><strong>RADIO 1 · BLITZ LIVE SOURCE</strong>'+
    '<b id="brVerifyRadio1Song">NOT CHECKED</b>'+
    '<p id="brVerifyRadio1State" role="status">Checking requires a reachable Blitz stream and an authorized DJ session.</p>'+
    '<p id="brVerifyRadio1Playlist">On-air playlist: not checked</p>'+
    '<label style="font-size:12px" for="brVerifyRadio1Audio">TEST ACTUAL RADIO 1 AUDIO</label>'+
    '<audio id="brVerifyRadio1Audio" controls preload="none" src="https://radio.grandelement.blitz.cloud/stream.mp3"></audio>'+
    '<p id="brVerifyRadio1AudioState" class="geVerifyNote">Press Play to test. Connection metadata alone is not audio playback.</p></div>'+
    '<div class="geVerifyCard"><strong>RADIO 2 · CLOUDFLARE BACKUP</strong>'+
    '<b id="brVerifyRadio2Song">NOT CHECKED</b>'+
    '<p id="brVerifyRadio2State" role="status">The station clock predicts the current scheduled song.</p>'+
    '<p id="brVerifyRadio2Playlist">Published schedule: not checked</p>'+
    '<label style="font-size:12px" for="brVerifyRadio2Audio">PREVIEW SCHEDULED AUDIO FILE</label>'+
    '<audio id="brVerifyRadio2Audio" controls preload="none"></audio>'+
    '<p id="brVerifyRadio2AudioState" class="geVerifyNote">Preview plays a song file, not the synchronized broadcast.</p></div>'+
    '<div class="geVerifyCard"><strong>GITHUB · SAVED WEBSITE PLAYLISTS</strong>'+
    '<b id="brVerifyGithubName">NOT CHECKED</b>'+
    '<p id="brVerifyGithubState" role="status">Reads the GitHub playlist registry without Blitz.</p>'+
    '<p id="brVerifyGithubDetail">Saving here does not automatically change the two live radio queues.</p>'+
    '</div></div>'+
    '<p id="brVerifyCheckedAt" class="geVerifyNote" aria-live="polite">No verification completed yet.</p>';
  var before=root.querySelector('.brRadioOnAir');
  root.insertBefore(section,before||root.firstChild);
  function el(id){return document.getElementById(id);}
  function txt(id,value){var node=el(id);if(node)node.textContent=String(value);}
  function short(value,max){return String(value||'').slice(0,max||150);}
  function stamp(ms){return ms>0&&Number.isFinite(ms)?new Date(ms).toLocaleString():'unknown';}
  function withTimeout(p,ms){return Promise.race([Promise.resolve(p),new Promise(function(_,reject){setTimeout(function(){reject(Error('Request timed out'));},ms);})]);}
  async function json(url){
    var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},9000);
    try{
      var r=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!r.ok)throw Error('HTTP '+r.status);
      return await r.json();
    }finally{clearTimeout(timeout);}
  }
  async function radio1(){
    try{
      if(typeof window.GE_BACKROOM_DJ_STATUS!=='function')throw Error('Backroom status connector unavailable');
      var data=await withTimeout(window.GE_BACKROOM_DJ_STATUS(),11000);
      var now=data&&data.now||{};
      var title=short(now.title||'No song reported');
      txt('brVerifyRadio1Song',title);
      var onAir=short(data.active_playlist_name||'Unknown playlist');
      txt('brVerifyRadio1Playlist','BLITZ reported on-air playlist: '+onAir+
        (data.custom_mix_enabled?' · Custom mix enabled':' · Normal rotation'));
      var mount=!!(data.public_master&&data.public_master.ok===true);
      var meta=data.now_metadata_source==='icecast';
      var started=Number(data.now_started_at)*1000;
      var age=started>0?Date.now()-started:NaN;
      var duration=Number(data.now_duration)*1000;
      var stale=Number.isFinite(age)&&Number.isFinite(duration)&&duration>0&&age>duration+90000;
      if(mount&&meta&&!stale){
        txt('brVerifyRadio1State','STREAM MOUNT RESPONDING · ICECAST TRACK METADATA · '+stamp(Date.now())+
          '. Play the audio below to verify reception.');
      }else if(mount){
        txt('brVerifyRadio1State','STREAM MOUNT RESPONDING · Track is '+(meta?'possibly stale':'last reported, not verified from Icecast')+
          '. Play below to verify actual reception.');
      }else{
        txt('brVerifyRadio1State','PUBLIC STREAM NOT VERIFIED · Last reported song only. The DJ control response does NOT prove audio is on air.');
      }
    }catch(error){
      txt('brVerifyRadio1Song','RADIO 1 NOT VERIFIED');
      txt('brVerifyRadio1Playlist','On-air playlist: unavailable');
      txt('brVerifyRadio1State',short(error.message||error,170)+
        ' · Blitz may be stopped, out of minutes, or the session may need authorization.');
    }
  }
  async function radio2(){
    try{
      var base='https://ge-radio-sync.grandelement.workers.dev';
      var responses=await Promise.all([json(base+'/v1/program'),json(base+'/v1/state').catch(function(){return null;})]);
      var body=responses[0],state=responses[1],p=body&&body.program;
      if(!body||body.ok!==true||!p||!Array.isArray(p.tracks)||!p.tracks.length)
        throw Error('No published Radio 2 program was returned');
      var tracks=p.tracks,cycle=Number(p.cycle_duration_ms);
      if(!(cycle>0))cycle=tracks.reduce(function(sum,t){return sum+Number(t.duration_ms||0);},0);
      var epoch=Number(p.epoch_utc_ms),now=Number(body.server_now_ms||Date.now());
      if(!(cycle>0)||!Number.isFinite(epoch))throw Error('Radio 2 has no usable station clock');
      var position=((now-epoch)%cycle+cycle)%cycle;
      var selected=null;
      for(var i=0;i<tracks.length;i++){
        var d=Number(tracks[i].duration_ms);
        if(!(d>0))throw Error('Incomplete Radio 2 track timing');
        if(position<d){selected=tracks[i];break;}
        position-=d;
      }
      if(!selected)throw Error('Radio 2 clock did not resolve a song');
      txt('brVerifyRadio2Song',short(selected.title||selected.path||'Scheduled track'));
      var station=state&&state.station,selectedStation=station&&station.to;
      var start=Number(station&&station.start_at_ms||0),duration=Number(station&&station.duration_ms||0);
      var scheduled='Listener station choice not verified';
      if(station){
        if(start>now&&station.from!==station.to)selectedStation=station.from;
        else if(start>0&&now>=start&&now<start+duration&&station.from!==station.to)
          selectedStation='transition';
        scheduled=selectedStation==='ge'?'Radio 2 selected for listeners':
          selectedStation==='blitz'?'Radio 2 is on standby':
          selectedStation==='transition'?'Station crossfade in progress':'Listener station choice not verified';
      }
      txt('brVerifyRadio2State','SCHEDULED NOW · '+scheduled+
        ' · Station-clock prediction, not proof of audible output.');
      txt('brVerifyRadio2Playlist',short(p.playlist_name||'Unnamed playlist')+' · '+tracks.length+
        ' songs · revision '+String(p.revision||'unavailable')+
        ' · published '+stamp(Number(p.published_at_ms)));
      var player=el('brVerifyRadio2Audio');
      var url=String(selected.url||'');
      if(/^https:\/\//i.test(url)){
        if(player.dataset.track!==url){player.pause();player.src=url;player.dataset.track=url;}
      }else{
        player.pause();player.removeAttribute('src');player.removeAttribute('data-track');player.load();
      }
    }catch(error){
      txt('brVerifyRadio2Song','RADIO 2 NOT VERIFIED');
      txt('brVerifyRadio2State',short(error.message||error,170));
      txt('brVerifyRadio2Playlist','Backup program and current song not confirmed');
      var player=el('brVerifyRadio2Audio');
      player.pause();player.removeAttribute('src');player.removeAttribute('data-track');player.load();
    }
  }
  async function github(){
    var base='https://raw.githubusercontent.com/grandelement/website/main/playlists/registry.json';
    try{
      var data=await json(base+'?verify='+Date.now());
      if(data.format!=='ge-playlist-registry-v1'||!Array.isArray(data.playlists))
        throw Error('Invalid published playlist registry');
      var songs=data.playlists.reduce(function(n,p){return n+(Array.isArray(p.songs)?p.songs.length:0);},0);
      var bangers=data.playlists.find(function(p){return String(p.name).toLowerCase()==='bangers';});
      var selectedName=String((el('brPlaylistName')||{}).value||'').trim();
      var selected=selectedName&&data.playlists.find(function(p){return String(p.name).toLowerCase()===selectedName.toLowerCase();});
      txt('brVerifyGithubName',data.playlists.length+' SAVED PLAYLISTS');
      txt('brVerifyGithubState','GITHUB MAIN REGISTRY READ VERIFIED · '+songs+' total playlist entries.'+
        (bangers?' Bangers: '+bangers.songs.length+' songs.':' Bangers not found.'));
      txt('brVerifyGithubDetail',selected?
        'SELECTED PLAYLIST FOUND: '+short(selected.name,70)+' · '+selected.songs.length+' songs · saved '+
          (selected.updated_at||'unknown')+'. This does NOT verify either live radio queue.':
        (selectedName?'SELECTED NAME NOT FOUND IN GITHUB MAIN: '+short(selectedName,70)+'. ':
          '')+(bangers?'Bangers registry saved '+(bangers.updated_at||'unknown')+'.':'Playlist store is independent from Blitz.'));
    }catch(error){
      txt('brVerifyGithubName','GITHUB NOT VERIFIED');
      txt('brVerifyGithubState',short(error.message||error,160));
      txt('brVerifyGithubDetail','No proof of the latest saved playlist. Retry REFRESH LIVE STATUS.');
    }
  }
  var busy=false;
  async function refresh(){
    if(busy)return;
    busy=true;
    el('brVerifyRefresh').disabled=true;
    txt('brVerifyCheckedAt','Checking three independent sources…');
    try{await Promise.allSettled([radio1(),radio2(),github()]);}
    finally{
      busy=false;
      el('brVerifyRefresh').disabled=false;
      txt('brVerifyCheckedAt','Last source check: '+new Date().toLocaleTimeString()+
        ' · Playback status requires pressing Play. No automatic changes to a radio queue.');
    }
  }
  function audioStatus(audioId,stateId,label){
    var node=el(audioId);
    node.addEventListener('playing',function(){txt(stateId,label+' PLAYING IN THIS BROWSER · '+new Date().toLocaleTimeString());});
    node.addEventListener('waiting',function(){txt(stateId,label+' BUFFERING · not yet proven playing');});
    node.addEventListener('stalled',function(){txt(stateId,label+' STALLED · check connection');});
    node.addEventListener('error',function(){txt(stateId,label+' FAILED TO PLAY · stream/file could not be decoded or reached');});
    node.addEventListener('pause',function(){if(!node.ended)txt(stateId,label+' PAUSED');});
  }
  audioStatus('brVerifyRadio1Audio','brVerifyRadio1AudioState','RADIO 1 STREAM');
  audioStatus('brVerifyRadio2Audio','brVerifyRadio2AudioState','RADIO 2 FILE PREVIEW');
  el('brVerifyRefresh').addEventListener('click',function(){void refresh();});
  // Reload source verification after the existing authenticated playlist writer confirms readback.
  var savedStatus=el('brPlaylistStatus'),lastVerifiedText='';
  if(savedStatus&&window.MutationObserver){
    new MutationObserver(function(){
      var next=savedStatus.textContent||'';
      if(next===lastVerifiedText||!(/SAVED & VERIFIED IN GITHUB|DELETED FROM GITHUB PLAYLIST FILE/i).test(next))return;
      lastVerifiedText=next;
      setTimeout(function(){void refresh();},1800);
    }).observe(savedStatus,{childList:true,characterData:true,subtree:true});
  }
  var radioPanel=document.getElementById('brPanel-radio');
  function visible(){return document.visibilityState==='visible'&&radioPanel&&!radioPanel.hidden;}
  document.querySelectorAll('[data-tab="radio"]').forEach(function(button){
    button.addEventListener('click',function(){setTimeout(function(){if(visible())void refresh();},250);});
  });
  setInterval(function(){if(visible())void refresh();},30000);
  if(visible())void refresh();
})();