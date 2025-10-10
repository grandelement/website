export function init({HUD, ROOT_IMG}){
  const host = document.getElementById('planets');
  if(!host){ HUD?.err('planets.js: #planets not found'); return; }

  const ALBUMS = [
    ["Fundamental Groove","Grand Element - Fundamental Groove.jpg","https://grandelement.bandcamp.com/album/fundamental-groove"],
    ["Trio","Grand Element - Trio.jpg","https://grandelement.bandcamp.com/album/trio"],
    ["Live!","Grand Element - Live.jpg","https://grandelement.bandcamp.com/album/live"],
    ["Sessions I","Grand Element - Sessions I.jpg","https://grandelement.bandcamp.com/album/sessions-i"],
    ["Sessions II","Grand Element - Sessions II.jpg","https://grandelement.bandcamp.com/album/sessions-ii"],
    ["Intergy","Grand Element - Intergy.jpg","https://grandelement.bandcamp.com/album/intergy"],
    ["Love","Grand Element - Love.jpg","https://grandelement.bandcamp.com/album/love"],
    ["Soul","Grand Element - Soul.jpg","https://grandelement.bandcamp.com/album/soul"],
    ["Spirit","Grand Element - Spirit.jpg","https://grandelement.bandcamp.com/album/spirit"],
    ["Fire","Grand Element - Fire.jpg","https://grandelement.bandcamp.com/album/fire"]
  ];

  function place(){
    host.innerHTML = '';
    const w = innerWidth, h = innerHeight;
    const xCenter = w * 0.56;
    const yBottom = h * 0.88, yTop = h * 0.18;
    const amp = Math.max(80, w * 0.12), waves = 1.2;
    const size = matchMedia('(max-width:768px)').matches ? 28 : 36;

    ALBUMS.forEach((a,i)=>{
      const t = i/(ALBUMS.length-1);
      const y = yBottom - t*(yBottom-yTop);
      const x = xCenter + amp * Math.sin((t*Math.PI*2*waves)-Math.PI/2);

      const el = document.createElement('div');
      el.className = 'planet';
      el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;cursor:pointer;box-shadow:0 0 10px rgba(255,255,255,.25)`;
      el.style.background = `center/cover no-repeat url("${ROOT_IMG}${a[1]}")`;

      const label = document.createElement('div');
      label.className='label';
      label.textContent=a[0];
      label.style.cssText='position:absolute;left:50%;top:-8px;transform:translate(-50%,-100%);border-radius:999px;background:rgba(15,25,50,.35);border:1px solid rgba(200,220,255,.5);padding:6px 10px;font-size:12px;font-weight:700;backdrop-filter:blur(2px);opacity:0;transition:opacity .15s';
      el.appendChild(label);
      el.addEventListener('mouseenter',()=>label.style.opacity=1);
      el.addEventListener('mouseleave',()=>label.style.opacity=0);

      // drag without opening
      let moved=false, startX=0, startY=0;
      el.addEventListener('pointerdown',e=>{ moved=false; startX=e.clientX; startY=e.clientY; el.setPointerCapture(e.pointerId); });
      el.addEventListener('pointermove',e=>{
        if(!el.hasPointerCapture(e.pointerId)) return;
        const dx=e.clientX-startX, dy=e.clientY-startY;
        if(Math.hypot(dx,dy)>3) moved=true;
        el.style.left = (x+dx)+'px';
        el.style.top  = (y+dy)+'px';
      });
      el.addEventListener('pointerup',e=>{
        el.releasePointerCapture(e.pointerId);
        if(!moved) window.open(a[2],'_blank','noopener');
      });

      host.appendChild(el);
    });
  }
  place();
  addEventListener('resize', place, {passive:true});
}
