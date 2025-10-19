// hidden_text.js — sprinkle a few hidden phrases
(function(){
  const host=document.createElement('div'); host.className='layer-hiddentext'; document.body.appendChild(host);
  const phrases=["you are the grand element","listen","breathe","move","feel","become"];
  for(let i=0;i<phrases.length;i++){
    const p=document.createElement('div'); p.className='phrase'; p.textContent=phrases[i];
    p.style.left=(10+Math.random()*80)+'vw'; p.style.top=(10+Math.random()*80)+'vh'; host.appendChild(p);
  }
  GE_ENV.mark('hidden_text.js','phrases placed');
})();
