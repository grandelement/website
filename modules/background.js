// purely here to size the canvas and avoid memory leaks
const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d');
let W=innerWidth,H=innerHeight;
function resize(){ W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; }
addEventListener('resize', resize, {passive:true}); resize();
// game.js will actually draw — this module just reserves the canvas.
