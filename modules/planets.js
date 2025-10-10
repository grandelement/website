// modules/planets.js
import { $, $$, isMobile, modOK, modFAIL } from './core.js';

try {
  const ALBUMS = [
    { t:"Fundamental Groove", c:"images/Grand Element - Fundamental Groove.jpg", l:"https://grandelement.bandcamp.com/album/fundamental-groove" },
    { t:"Trio",        c:"images/Grand Element - Trio.jpg",        l:"https://grandelement.bandcamp.com/album/trio" },
    { t:"Live!",       c:"images/Grand Element - Live.jpg",        l:"https://grandelement.bandcamp.com/album/live" },
    { t:"Sessions I",  c:"images/Grand Element - Sessions I.jpg",  l:"https://grandelement.bandcamp.com/album/sessions-i" },
    { t:"Sessions II", c:"images/Grand Element - Sessions II.jpg", l:"https://grandelement.bandcamp.com/album/sessions-ii" },
    { t:"Intergy",     c:"images/Grand Element - Intergy.jpg",     l:"https://grandelement.bandcamp.com/album/intergy" },
    { t:"Love",        c:"images/Grand Element - Love.jpg",        l:"https://grandelement.bandcamp.com/album/love" },
    { t:"Soul",        c:"images/Grand Element - Soul.jpg",        l:"https://grandelement.bandcamp.com/album/soul" },
    { t:"Spirit",      c:"images/Grand Element - Spirit.jpg",      l:"https://grandelement.bandcamp.com/album/spirit" },
    { t:"Fire",        c:"images/Grand Element - Fire.jpg",        l:"https://grandelement.bandcamp.com/album/fire" },
  ];

  const root = $('#planets');
  function place() {
    root.innerHTML = '';
    const w = innerWidth, h = innerHeight;
    const xCenter = w * 0.56;
    const yBottom = h * 0.88;
    const yTop    = h * 0.14;
    const amp     = Math.max(80, w * (isMobile()?0.16:0.12));
    const waves   = 1.2;

    ALBUMS.forEach((a, i) => {
      const t = i/(ALBUMS.length-1);
      const y = yBottom - t*(yBottom - yTop);
      const x = xCenter + amp * Math.sin((t * Math.PI * 2 * waves) - Math.PI/2);

      const el = document.createElement('a');
      el.className = 'planet';
      el.style.left = x+'px';
      el.style.top  = y+'px';
      el.style.backgroundImage = `url('${a.c}')`;
      el.href = a.l; el.target = '_blank'; el.rel='noopener';
      el.innerHTML = `<span class="label">${a.t}</span>`;
      // click-vs-drag guard
      let moved=false, downX=0, downY=0;
      el.addEventListener('pointerdown', e=>{ moved=false; downX=e.clientX; downY=e.clientY; });
      el.addEventListener('pointermove', e=>{ if(Math.hypot(e.clientX-downX,e.clientY-downY)>6) moved=true; });
      el.addEventListener('click', e=>{ if(moved) e.preventDefault(); });

      root.appendChild(el);
    });
  }
  place();
  addEventListener('resize', place, { passive:true });

  modOK('planets.js');
} catch (e) {
  modFAIL('planets.js', e);
}
