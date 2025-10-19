// fx.js — teleport ripple + background shuffle
(function(){
  const rp = GE_CANVAS.rippleCtx;
  const BACKGROUNDS = [
    "images/GE stars.jpg" /* replace or add more images here if you’d like */
  ];
  let bgIndex=0, teleportBusy=false;
  function setBG(i){ document.body.style.backgroundImage = `url("${BACKGROUNDS[i%BACKGROUNDS.length]}")`; }

  window.GE_FX = {
    teleportFrom(x,y){
      if(teleportBusy) return; teleportBusy=true;
      const start=performance.now(), dur=1600;
      function draw(now){
        const t=Math.min(1,(now-start)/dur);
        rp.clearRect(0,0,innerWidth,innerHeight);
        rp.save(); rp.globalAlpha=0.35*(1-t);
        rp.beginPath(); rp.arc(x,y, Math.hypot(innerWidth,innerHeight)*t, 0, Math.PI*2);
        rp.lineWidth=6*(1-t)+1; rp.strokeStyle='rgba(120,180,255,0.85)'; rp.stroke(); rp.restore();
        if(t<1) requestAnimationFrame(draw);
        else { rp.clearRect(0,0,innerWidth,innerHeight); bgIndex=(bgIndex+1)%BACKGROUNDS.length; setBG(bgIndex); teleportBusy=false; }
      }
      requestAnimationFrame(draw);
    }
  };
  GE_ENV.mark('fx.js','FX ready (ripple/bg shuffle)');
})();
