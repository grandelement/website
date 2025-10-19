export function init({HUD, ROOT_DATA}){
  const layer = document.getElementById('phrases');
  if(!layer){ HUD?.err('hidden-text.js: #phrases not found'); return; }

  fetch(`${ROOT_DATA}hidden.txt`).then(r=>r.ok?r.text():'').then(t=>{
    const terms = t.split(/[,\r?\n]/).map(s=>s.trim()).filter(Boolean);
    const N = Math.max(10, terms.length||0);
    layer.innerHTML='';
    for(let i=0;i<N;i++){
      const d = document.createElement('div');
      d.className='phrase';
      d.textContent = terms[i%terms.length] || '—';
      d.style.left = (Math.random()*(innerWidth-220)+10)+'px';
      d.style.top  = (Math.random()*(innerHeight-120)+10)+'px';
      layer.appendChild(d);
    }
    // reveal within radius of pointer
    let mx=-9999,my=-9999; addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY});
    setInterval(()=>{ const r=140; [...layer.children].forEach(el=>{ const b=el.getBoundingClientRect(); const d=Math.hypot(mx-(b.left+b.width/2), my-(b.top+b.height/2)); el.classList.toggle('show', d<r); }); },60);
  }).catch(e=>HUD?.err(e));
}
