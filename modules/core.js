export function init(cfg){
  const {HUD} = cfg;
  // Canvas resize utility others can read
  const cvs = document.getElementById('fx');
  const ctx = cvs.getContext('2d');
  function resize(){ cvs.width = innerWidth; cvs.height = innerHeight; }
  addEventListener('resize', resize, {passive:true}); resize();
  // Export globals for other modules (attached safely)
  window.GE = Object.assign(window.GE||{}, {
    HUD,
    ROOT_IMG: cfg.ROOT_IMG,
    ROOT_DATA: cfg.ROOT_DATA,
    ROOT_MUS: cfg.ROOT_MUS,
    cvs, ctx
  });
}
