// sun_moon.js — blue sun + 60s moon orbit (label stays upright)
(function(){
  const wrap=document.createElement('div'); wrap.id='sunWrap';
  wrap.innerHTML = `
    <div class="sun">
      <div class="sunOverlay">
        <div class="sunAbout" id="aboutBtn">ABOUT</div>
        <button class="controlsToggle" id="musicBtn">Music</button>
        <div class="miniPlayer" id="miniPlayer">
          <div class="btn" id="prev">⏮</div>
          <div class="btn" id="play">▶</div>
          <div class="btn" id="next">⏭</div>
          <div class="title" id="title">—</div>
          <input class="range" id="seek" type="range" min="0" max="100" value="0"/>
          <input class="range" id="vol" type="range" min="0" max="1" step="0.01" value="0.9"/>
          <audio id="audio" preload="auto" playsinline></audio>
        </div>
      </div>
    </div>
    <div class="orbit"><div class="carrier"><div class="moon" id="moon" title="GE RADIO"></div></div></div>
  `;
  document.body.appendChild(wrap);

  const carrier = wrap.querySelector('.carrier');
  const moon = wrap.querySelector('#moon');
  const ORBIT_SECONDS = 60;
  (function loop(){ const t=performance.now()/1000, ang=-2*Math.PI*(t/ORBIT_SECONDS); carrier.style.transform=`rotate(${ang}rad)`; moon.style.transform=`translate(var(--orbit-radius),-50%) rotate(${-ang}rad)`; requestAnimationFrame(loop); })();

  // about & radio
  wrap.querySelector('#aboutBtn').onclick=()=>window.open('https://grandelement.com/about','_blank','noopener');
  moon.onclick=()=>window.open('https://grandelement.github.io/radio/','_blank','noopener');

  // expose a toggle API; player logic is in mini_player.js
  window.GE_MINI = { toggle(){ document.getElementById('miniPlayer').classList.toggle('show'); } };
  document.getElementById('musicBtn').onclick = ()=>GE_MINI.toggle();

  GE_ENV.mark('sun_moon.js','sun & moon placed');
})();
