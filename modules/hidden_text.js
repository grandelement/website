const phrasesEl = document.getElementById('layer-phrases');
const URL = window.GE_CONFIG.hiddenTextUrl;
fetch(URL).then(r=>r.ok?r.text():'').then(t=>{
  const P = t.split(/[,\r?\n]/).map(s=>s.trim().replace(/,+$/,'')).filter(Boolean);
  const n = Math.max(10, P.length||10), W=innerWidth, H=innerHeight;
  for(let i=0;i<n;i++){
    const el=document.createElement('div'); el.className='phrase';
    el.textContent=P[i%(P.length||1)]||''; el.style.left=(10+Math.random()*(W-220))+'px'; el.style.top=(10+Math.random()*(H-120))+'px';
    el.addEventListener('click',()=>el.classList.toggle('pinned')); phrasesEl.appendChild(el);
  }
});
let mx=-9999,my=-9999; addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;},{passive:true});
setInterval(()=>{ const r=Math.min(innerWidth,innerHeight)*.12; [...phrasesEl.children].forEach(el=>{
  if(el.classList.contains('pinned')){ el.classList.add('show'); return; }
  const b=el.getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height/2;
  Math.hypot(mx-cx,my-cy)<r ? el.classList.add('show') : el.classList.remove('show');
});},110);
