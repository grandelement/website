/* Grand Element Ship: album planet flybys.
 * This is a VISUAL-ONLY layer. It never changes Radio playback, Gate timing,
 * the protected steering physics, or the permanent Blue Sun / arrival scene.
 * Flight forward/backward traverses a separate, reversible album timeline.
 */
(function(){
  'use strict';
  const stage=document.getElementById('shipStage');
  const windowView=document.getElementById('shipWindowViewport');
  if(!stage||!windowView)return;
  const catalog={
    'intergy':'Grand Element - Intergy.jpg',
    'love':'Grand Element - Love.jpg',
    'soul':'Grand Element - Soul.jpg',
    'spirit':'Grand Element - Spirit.jpg',
    'fire':'Grand Element - Fire.jpg',
    'sessions i':'Grand Element - Sessions I.jpg',
    'sessions ii':'Grand Element - Sessions II.jpg',
    'live!':'Grand Element - Live.jpg',
    'trio':'Grand Element - Trio.jpg',
    'singles':'ge-logo 3.png'
  };
  const labelMap={'intergy':'Intergy','love':'Love','soul':'Soul','spirit':'Spirit','fire':'Fire',
    'sessions i':'Sessions I','sessions ii':'Sessions II','live!':'Live!',
    'trio':'Trio','singles':'Singles'};
  const normalize=album=>String(album||'').trim().toLowerCase().replace(/\s+/g,' ');
  const layer=document.createElement('div');layer.id='shipAlbumFlybyLayer';
  layer.setAttribute('aria-hidden','true');windowView.appendChild(layer);
  const style=document.createElement('style');style.id='ge-ship-album-flyby-style';
  style.textContent=`
    #shipAlbumFlybyLayer{position:absolute;inset:0;z-index:7;overflow:hidden;pointer-events:none}
    #shipAlbumFlybyLayer .ge-flyby-planet{position:absolute;left:0;top:0;will-change:transform,opacity;
      display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;
      transform-origin:center center;opacity:0}
    #shipAlbumFlybyLayer .ge-flyby-planet img{width:100%;height:auto;aspect-ratio:1;object-fit:cover;
      border-radius:50%;border:1px solid rgba(138,223,255,.38);
      box-shadow:0 0 24px rgba(47,150,215,.24),inset 0 0 18px rgba(9,28,50,.9)}
    #shipAlbumFlybyLayer .ge-flyby-planet[data-album="singles"] img{filter:grayscale(1) contrast(1.18)}
    #shipAlbumFlybyLayer .ge-flyby-planet span{max-width:100%;overflow:hidden;text-overflow:ellipsis;
      padding:2px 5px;color:#dcf5ff;font:bold clamp(8px,.84vw,14px)/1.1 system-ui,sans-serif;
      text-align:center;text-shadow:0 2px 5px #000;white-space:nowrap;background:rgba(0,9,22,.35);
      border-radius:20px}
    body:not(.view-ship) #shipAlbumFlybyLayer,body.view-ship.arrival-mode #shipAlbumFlybyLayer{display:none}
    @media(prefers-reduced-motion:reduce){#shipAlbumFlybyLayer .ge-flyby-planet{will-change:auto}}
  `;document.head.appendChild(style);
  const KEY='GE_SHIP_ALBUM_FLYBYS_V1';
  let distance=0,events=[],counter=0,lastSong='',lastTick=0,backupSave=0;
  function save(){
    try{sessionStorage.setItem(KEY,JSON.stringify({distance,events:events.slice(-32).map(e=>({
      id:e.id,z:e.z,album:e.album,side:e.side,drift:e.drift, song:e.song
    })),counter,lastSong}));}catch(_e){}
  }
  function restore(){
    try{
      const x=JSON.parse(sessionStorage.getItem(KEY)||'null');
      if(!x||typeof x!=='object'||!Array.isArray(x.events))return;
      distance=Math.max(0,Math.min(1000,Number(x.distance)||0));
      counter=Math.max(0,Number(x.counter)||0);
      lastSong=String(x.lastSong||'');
      events=x.events.slice(-32).filter(e=>catalog[normalize(e.album)]&&Number.isFinite(Number(e.z)))
        .map(e=>({id:e.id,z:Number(e.z),album:labelMap[normalize(e.album)],
          side:e.side===-1?-1:1,drift:Number(e.drift)||0,song:String(e.song||'')}));
    }catch(_e){}
  }
  restore();
  function createNode(e){
    const n=document.createElement('div');n.className='ge-flyby-planet';n.dataset.album=normalize(e.album);
    const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';
    img.src=new URL('../ge-images/images/'+encodeURIComponent(catalog[normalize(e.album)]),location.href).href;
    img.onerror=()=>{n.style.display='none'};
    const label=document.createElement('span');label.textContent=e.album;
    n.appendChild(img);n.appendChild(label);layer.appendChild(n);e.node=n;return n;
  }
  events.forEach(createNode);
  function addSong(album,song,identity){
    const k=normalize(album);if(!catalog[k])return false;
    const key=String(identity||album+' / '+song);
    if(key===lastSong)return false;
    lastSong=key;
    const last=events.length?events[events.length-1]:null;
    const ordinal=counter++;
    const z=Math.max(distance+2.1,last?last.z+.63:0);
    const e={id:ordinal,z,album:labelMap[k],song:String(song||''),side:ordinal%2?-1:1,
      drift:(ordinal%3-1)*.1};
    events.push(e);createNode(e);
    while(events.length>32){const old=events.shift();old.node?.remove();}
    save();return true;
  }
  window.addEventListener('ge-current-song',event=>{
    const d=event.detail||{};
    addSong(d.album,d.title,d.key||d.album+' / '+d.title);
  });
  function render(dt){
    // The protected Blue Sun stays anchored to the ship's permanent center.
    // Flybys follow their OWN reversible depth coordinate and cannot alter
    // the Blue Sun's arrival proximity or open/close its message window.
    const ship=window.GEShip;
    const throttle=Math.max(-100,Math.min(100,Number(ship?.getThrottle?.())||0));
    const gate=document.getElementById('geGate');
    const playing=!(document.getElementById('player')?.paused);
    let rate=playing?.017:0;
    if(throttle>0)rate+=Math.pow(throttle/100,1.1)*.115;
    if(throttle<0)rate=-Math.pow(-throttle/100,1.1)*.16;
    if(document.body.classList.contains('view-ship')&&!gate?.classList.contains('open'))
      distance=Math.max(0,Math.min(1000,distance+rate*dt));
    const blueArrival=Number(ship?.getApproachDistance?.())>.991;
    for(const e of events){
      const n=e.node||createNode(e);
      const remaining=e.z-distance;
      const onScreen=!blueArrival && remaining<4.1 && remaining>-.95;
      if(!onScreen){n.style.opacity='0';n.style.visibility='hidden';continue;}
      n.style.visibility='visible';
      const closeness=Math.max(0,Math.min(1,(3.5-remaining)/3.5));
      const departed=Math.max(0,Math.min(1,(-remaining+.08)/1.03));
      const w=3+30*Math.pow(closeness,1.72);
      const x=50+e.side*(19+12*Math.pow(closeness,1.2))+e.drift*6;
      const y=26+e.drift*12+10*Math.pow(closeness,1.2);
      n.style.width=w.toFixed(3)+'%';
      n.style.transform='translate(-50%,-50%) translate('+x.toFixed(2)+'vw,'+y.toFixed(2)+'%)';
      // Absolute percentages keep the windowside flybys independent of the
      // cockpit frame and orientation. The Blue Sun uses its original layer.
      n.style.left=x.toFixed(2)+'%';n.style.top=y.toFixed(2)+'%';
      n.style.transform='translate(-50%,-50%)';
      n.style.opacity=(Math.min(1,Math.max(0,(4.1-remaining)*1.3))*(1-departed)).toFixed(3);
    }
  }
  let last=0;
  function frame(ms){
    if(!last)last=ms;
    const dt=Math.max(0,Math.min(.1,(ms-last)/1000));last=ms;
    if(document.body.classList.contains('view-ship'))render(dt);
    if(ms-backupSave>10000){backupSave=ms;save();}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('pagehide',save);
  window.GEShipAlbumFlybys={addSong,getState:()=>({distance,count:events.length,albums:events.map(e=>e.album)})};
})();