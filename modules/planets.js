const C=window.GE_CONFIG, base=C.imagesBase;
const ALBUMS=[
  { title:'Fundamental\u00A0Groove', cover:'Grand%20Element%20-%20Fundamental%20Groove.jpg', link:'https://grandelement.bandcamp.com/album/fundamental-groove' },
  { title:'Trio',        cover:'Grand%20Element%20-%20Trio.jpg',        link:'https://grandelement.bandcamp.com/album/trio' },
  { title:'Live!',       cover:'Grand%20Element%20-%20Live.jpg',        link:'https://grandelement.bandcamp.com/album/live' },
  { title:'Sessions I',  cover:'Grand%20Element%20-%20Sessions%20I.jpg',  link:'https://grandelement.bandcamp.com/album/sessions-i' },
  { title:'Sessions II', cover:'Grand%20Element%20-%20Sessions%20II.jpg', link:'https://grandelement.bandcamp.com/album/sessions-ii' },
  { title:'Intergy',     cover:'Grand%20Element%20-%20Intergy.jpg',     link:'https://grandelement.bandcamp.com/album/intergy' },
  { title:'Love',        cover:'Grand%20Element%20-%20Love.jpg',        link:'https://grandelement.bandcamp.com/album/love' },
  { title:'Soul',        cover:'Grand%20Element%20-%20Soul.jpg',        link:'https://grandelement.bandcamp.com/album/soul' },
  { title:'Spirit',      cover:'Grand%20Element%20-%20Spirit.jpg',      link:'https://grandelement.bandcamp.com/album/spirit' },
  { title:'Fire',        cover:'Grand%20Element%20-%20Fire.jpg',        link:'https://grandelement.bandcamp.com/album/fire' },
];
const root=document.documentElement, planets=document.getElementById('planets');

function place(){
  planets.innerHTML='';
  const size = innerWidth<820 ? C.planetSizeMobile : C.planetSizeDesktop;
  root.style.setProperty('--planet-size', size+'px');
  for(const alb of ALBUMS){
    const el=document.createElement('a');
    el.className='planet';
    el.style.width=size+'px'; el.style.height=size+'px';
    el.style.backgroundImage=`url('${base}${alb.cover}')`;
    el.innerHTML=`<div class="labelAlways">${alb.title}</div>`;
    planets.appendChild(el);
  }
  // spiral layout
  const w=innerWidth,h=innerHeight,xC=w*.56,yB=h*.88,yT=h*.14,amp=Math.max(80,w*.12),waves=1.2;
  [...planets.children].forEach((el,i,arr)=>{
    const t=i/(arr.length-1), y=yB-t*(yB-yT), x=xC+amp*Math.sin((t*Math.PI*2*waves)-Math.PI/2);
    el.style.left=x+'px'; el.style.top=y+'px';
    // click vs drag
    let sx,sy,moved=false, link=ALBUMS[i].link;
    el.addEventListener('pointerdown',e=>{ sx=e.clientX; sy=e.clientY; moved=false; el.classList.add('drag'); });
    addEventListener('pointermove',e=>{ if(!el.classList.contains('drag')) return;
      const dx=e.clientX-sx, dy=e.clientY-sy; if(Math.hypot(dx,dy)>6){ moved=true; el.style.left=(x+dx)+'px'; el.style.top=(y+dy)+'px'; }});
    addEventListener('pointerup',e=>{ if(!el.classList.contains('drag')) return;
      el.classList.remove('drag'); if(!moved) window.open(link,'_blank','noopener'); });
  });
}
place(); addEventListener('resize',place,{passive:true});
