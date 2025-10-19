// core.js — shared helpers
window.GE_CORE = (function(){
  const rand = (a,b)=>a+Math.random()*(b-a);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  return { rand, clamp };
})();
GE_ENV.mark('core.js','core loaded');
