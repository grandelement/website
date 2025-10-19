// modules/sun_moon.js
(function(){
  // container
  const wrap = document.createElement('div');
  wrap.id = 'sunWrap'; // CSS positions/size via core.css if you have it; we also set baseline style here:
  Object.assign(wrap.style, {position:'fixed', left:'16vw', top:'66vh', transform:'translate(-50%,-50%)', width:'280px', height:'280px', zIndex:5});
  wrap.innerHTML = `
    <div class="sun" style="
      position:absolute; inset:0; border-radius:50%;
      background:center/cover no-repeat url('images/ge-logo-2.jpg');
      box-shadow:inset 0 0 60px rgba(255,255,255,.12);
    ">
      <div class="sunOverlay" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; pointer-events:none;">
        <div id="aboutBtn" style="pointer-events:auto; margin-top:10%; font-weight:900; letter-spacing:.22em; font-size:13px; text-shadow:0 0 14px rgba(150,190,255,.55); cursor:pointer;">ABOUT</div>
        <button id="musicBtn" style="pointer-events:auto; margin-top:auto; margin-bottom:12%; font-weight:800; border:1px solid rgba(220,240,255,.35); background:rgba(12,24,40,.6); padding:6px 10px; border-radius:999px; cursor:pointer;">Music</button>
      </div>
    </div>
    <div class="orbit" style="position:absolute; inset:0; transform-origin:50% 50%; pointer-events:none;">
      <div class="carrier" style="position:absolute; left:50%; top:50%;">
        <div id="moon" title="GE RADIO" style="
          position:absolute; left:0; top:0; transform:translate(200px,-50%); width:110px; height:110px; border-radius:50%; pointer-events:auto; cursor:pointer;
          background: radial-gradient(circle, rgba(160,210,255,.55) 0%, rgba(160,210,255,.25) 60%, rgba(160,210,255,0) 70%), center/cover no-repeat url('images/ge-radio-logo.png');
          box-shadow:0 0 10px 4px rgba(140,200,255,.35); border:1px solid rgba(160,210,255,.55);
        "></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // 60s orbit, keep moon text upright
  const carrier = wrap.querySelector('.carrier');
  const moon    = wrap.querySelector('#moon');
  const ORBIT_SECONDS = 60;
  (function loop(){
    const t = performance.now()/1000;
    const ang = -2*Math.PI*(t/ORBIT_SECONDS); // clockwise
    carrier.style.transform = `rotate(${ang}rad)`;
    moon.style.transform = `translate(200px,-50%) rotate(${-ang}rad)`;
    requestAnimationFrame(loop);
  })();

  // Drag sun
  let dragging=false, sx=0,sy=0, startLeft=0, startTop=0;
  wrap.addEventListener('pointerdown', e=>{
    // don’t start drag when clicking moon or buttons
    if (e.target.id==='moon' || e.target.id==='aboutBtn' || e.target.id==='musicBtn') return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    // get current numeric positions
    const rect=wrap.getBoundingClientRect();
    startLeft = rect.left + rect.width/2;
    startTop  = rect.top  + rect.height/2;
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const nx = startLeft + (e.clientX - sx);
    const ny = startTop  + (e.clientY - sy);
    wrap.style.left = nx+'px';
    wrap.style.top  = ny+'px';
    wrap.style.transform = 'translate(-50%,-50%)';
  });
  wrap.addEventListener('pointerup', e=>{ dragging=false; try{ wrap.releasePointerCapture(e.pointerId);}catch(_){} });

  // Buttons
  wrap.querySelector('#aboutBtn').onclick = ()=> window.open('https://grandelement.com/about','_blank','noopener');
  moon.onclick = ()=> window.open('https://grandelement.github.io/radio/','_blank','noopener');
  wrap.querySelector('#musicBtn').onclick = ()=>{
    // Hand off to mini player if/when present
    if (window.GE_MINI?.toggle) GE_MINI.toggle();
  };

  // Allow FX module to rotate background when the sun is clicked (optional)
  wrap.addEventListener('click', e=>{
    if (e.target===wrap && window.GE_FX) {
      const r=wrap.getBoundingClientRect();
      GE_FX.nextFrom(r.left+r.width/2, r.top+r.height/2);
    }
  });

  if (window.GE_ENV?.mark) GE_ENV.mark('sun_moon.js','sun + 60s moon + drag ready');
})();
