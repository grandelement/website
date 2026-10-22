/* GRAND ELEMENT · ONE RADIO
 * Public website radio: BLITZ / Icecast live stream only.
 * Radio 2 scheduled playlist, Worker polling, and local shuffle failovers
 * intentionally disconnected (October 2026).
 * No change to the BLITZ server, LIVE handoff, or existing Gate.
 */
(function(){
'use strict';
var audio=document.getElementById('gePlayer');
var play=document.getElementById('play');
var stopButton=document.getElementById('geHomeStop');
var label=document.getElementById('geHomeRadioLink');
var status=document.getElementById('geHomeRadioStatus');
if(!audio||!play)return;
var STREAM='https://radio.grandelement.blitz.cloud/stream.mp3';
var wants=false,mode='idle',run=0,seen=false,lastTime=NaN,lastAdvance=0;
var watchdog=0,retryTimer=0,retries=0,waitingGesture=false;
function text(t){if(status)status.textContent=t}
function clearPending(){
 if(watchdog){clearTimeout(watchdog);watchdog=0}
 if(retryTimer){clearTimeout(retryTimer);retryTimer=0}
}
function display(){
 if(label)label.textContent='GRAND ELEMENT RADIO';
 play.textContent='PLAY';
 play.setAttribute('aria-label','Play Grand Element Radio');
 if(stopButton)stopButton.disabled=(!wants&&mode==='idle');
}
function media(){
 try{
  if('mediaSession' in navigator){
   navigator.mediaSession.metadata=new MediaMetadata({
    title:'Grand Element Radio',artist:'Grand Element',album:'BLITZ · LIVE'});
   navigator.mediaSession.setActionHandler('play',function(){start()});
   navigator.mediaSession.setActionHandler('pause',pause);
   navigator.mediaSession.setActionHandler('nexttrack',null);
   navigator.mediaSession.setActionHandler('previoustrack',null);
  }
 }catch(e){}
}
function allowed(){return !document.body.classList.contains('ge-broadcast-background')}
function freshURL(){
 var url=new URL(STREAM);
 url.searchParams.set('_ge_live_edge',String(Date.now()));
 return url.href;
}
function attempt(nonce){
 if(nonce!==run||!wants||!allowed()||document.hidden&&audio&&!audio.paused)return;
 clearPending();mode='radio1';seen=false;lastTime=NaN;lastAdvance=Date.now();
 waitingGesture=false;display();
 text(retries?'RADIO · RECONNECTING TO BLITZ ('+retries+')…':'RADIO · CONNECTING TO BLITZ…');
 try{
  audio.pause();audio.removeAttribute('src');audio.load();
  audio.removeAttribute('crossorigin');
  audio.autoplay=false;audio.preload='auto';audio.muted=false;
  audio.src=freshURL();audio.load();
  media();
  var promise=audio.play();
  if(promise&&typeof promise.catch==='function')promise.catch(function(error){
   if(nonce!==run||!wants)return;
   if(error&&error.name==='NotAllowedError'){
    waitingGesture=true;clearPending();
    text('TAP PLAY AGAIN · Your browser requires a play gesture');return;
   }
   failed(nonce);
  });
  watchdog=setTimeout(function(){
   if(nonce!==run||!wants||seen||waitingGesture||document.hidden)return;
   failed(nonce);
  },13000);
 }catch(e){failed(nonce)}
}
function failed(nonce){
 // 'error', play() rejection and watchdog can fire together in older Safari.
 // Schedule at most one retry for each failed stream attempt.
 if(nonce!==run||!wants||waitingGesture||retryTimer)return;
 clearPending();
 if(retries>=6){
  wants=false;mode='idle';try{audio.pause()}catch(e){}
  display();
  text('RADIO UNAVAILABLE · BLITZ DID NOT DELIVER AUDIO · TAP PLAY TO TRY AGAIN');
  return;
 }
 retries++;
 var delay=Math.min(30000,2500*Math.pow(1.65,retries-1));
 text('BLITZ RADIO UNAVAILABLE OR BUSY · RETRYING IN '+Math.ceil(delay/1000)+'s');
 retryTimer=setTimeout(function(){attempt(nonce)},delay);
}
function start(){
 if(!allowed())return;
 if(wants&&!audio.paused&&seen)return;
 // One additional user gesture can unlock a prepared iPhone audio element.
 if(waitingGesture&&wants){
  waitingGesture=false;
  try{
   var p=audio.play();
   if(p&&p.catch)p.catch(function(e){
    if(e&&e.name==='NotAllowedError'){waitingGesture=true;text('TAP PLAY TO START AUDIO')}
    else failed(run);
   });
   return;
  }catch(e){}
 }
 var nonce=++run;wants=true;retries=0;attempt(nonce);
}
function pause(){
 wants=false;run++;clearPending();
 try{audio.pause()}catch(e){}
 text('GRAND ELEMENT RADIO · PAUSED');display();
}
function stop(){
 wants=false;run++;clearPending();
 mode='idle';seen=false;waitingGesture=false;retries=0;
 try{audio.pause();audio.removeAttribute('src');audio.load()}catch(e){}
 text('GRAND ELEMENT RADIO · STOPPED');display();
 try{if('mediaSession' in navigator)navigator.mediaSession.playbackState='none'}catch(e){}
}
audio.addEventListener('playing',function(){if(wants){media();display()}});
audio.addEventListener('timeupdate',function(){
 if(!wants||audio.paused)return;
 var t=Number(audio.currentTime);
 if(!isFinite(t))return;
 if(isFinite(lastTime)&&t>lastTime+.08){
  seen=true;lastAdvance=Date.now();retries=0;
  if(watchdog){clearTimeout(watchdog);watchdog=0}
  text('GRAND ELEMENT RADIO · LIVE ON BLITZ');
 }
 lastTime=t;
});
audio.addEventListener('error',function(){if(wants)failed(run)});
audio.addEventListener('ended',function(){if(wants)failed(run)});
setInterval(function(){
 if(!wants||audio.paused||document.hidden||waitingGesture||!allowed())return;
 if(seen&&Date.now()-lastAdvance>17000)failed(run);
},3500);
document.addEventListener('visibilitychange',function(){
 if(!document.hidden&&wants&&audio.paused&&!waitingGesture&&!retryTimer)failed(run);
});
var controller=window.GE_MUSIC_CONTROLLER||{};
controller.playPause=function(){if(wants&&!audio.paused)pause();else start()};
controller.next=function(){};controller.prev=function(){};
controller.setShuffle=function(){return true};controller.getShuffle=function(){return true};
controller.selectTrackNumber=function(){return false};
// PLAY ALBUM on a planet opens the existing 33:33 music player with the
// chosen album selected. Do not send an album request to the live BLITZ station.
controller.playAlbum=function(albumTitle){
 var name=String(albumTitle||'').trim();
 if(!name)return false;
 var target=new URL('radio/preview-lab.html',location.href);
 target.searchParams.set('album',name);
 location.assign(target.href);
 return true;
};
controller.ensurePlaying=async function(){
 if(wants&&!audio.paused)return true;
 start();return wants&&!audio.paused;
};
controller.wantsPlayback=function(){return wants};
window.GE_MUSIC_CONTROLLER=controller;
play.onclick=start;
if(stopButton)stopButton.addEventListener('click',stop);
window.GE_HOME_RADIO={
 play:start,pause:pause,stop:stop,playPause:controller.playPause,
 isLiveMode:function(){return true},mode:function(){return mode},
 playing:function(){return wants&&!audio.paused},status:function(){return status?status.textContent:''}
};
if(label)label.addEventListener('click',function(event){
 event.preventDefault();event.stopPropagation();
 if(typeof openGrandElementRadio==='function')openGrandElementRadio();
 else location.assign(new URL('radio/',location.href).href);
});
display();text('RADIO READY · TAP PLAY FOR BLITZ');
})();