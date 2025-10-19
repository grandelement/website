// modules/background.js
//
// Stars background manager: no stretch, no over-zoom, crop only when the
// image is larger than the viewport. Exposes nextBackground()/setBackground().
//
const BG_DIR = 'images/stars backgrounds/';

// 1) List your background files here (add/remove as you like)
const BG_FILES = [
  'GE stars.jpg',
  'original.jpg',
  '9Ch3rMo7JnkDNd6phx3fQR.jpg',
  'Classifying-stars-by-colour.jpg',
  'hubble_ngc6440-jpg9.jpg',
  'ImageForArticle_549_17288689857007544.jpg',
  'KTFprsGURjv4nFDQH7fua.jpg',
];

// 2) Create the <img> that lives under everything else
let bg = document.getElementById('ge-bg-img');
if (!bg) {
  bg = document.createElement('img');
  bg.id = 'ge-bg-img';
  Object.assign(bg.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    objectFit: 'contain',       // default; we’ll switch dynamically
    objectPosition: 'center',
    zIndex: '-1',
    backgroundColor: '#000',
    userSelect: 'none',
    pointerEvents: 'none',
  });
  document.body.prepend(bg);
}

// 3) Loader with “no-upscale” + “crop when larger” policy
let current = 0;
let meta = { w: 0, h: 0 };

function applyFit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  // cover scale (would fill the screen, may crop)
  const scaleCover = Math.max(vw / meta.w, vh / meta.h);

  // If the image would need upscaling (>1) to cover, clamp at 1 (no upscaling),
  // and use contain-like sizing (centered, letterbox). If it’s bigger than
  // the viewport (scaleCover <= 1), use cover (fills, crops edges) with NO stretch.
  if (scaleCover <= 1) {
    bg.style.objectFit = 'cover';
  } else {
    bg.style.objectFit = 'contain';
  }
}

function load(index) {
  return new Promise((resolve, reject) => {
    const src = `${BG_DIR}${BG_FILES[index]}`;
    const img = new Image();
    img.onload = () => {
      meta.w = img.naturalWidth;
      meta.h = img.naturalHeight;
      bg.src = src;
      applyFit();
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

// 4) Public API
export async function setBackground(index) {
  if (index < 0 || index >= BG_FILES.length) return;
  current = index;
  try { await load(current); } catch (e) { /* ignore */ }
}

export async function nextBackground() {
  current = (current + 1) % BG_FILES.length;
  try { await load(current); } catch (e) { /* ignore */ }
}

export function currentBackgroundName() {
  return BG_FILES[current] || '';
}

// 5) Init + resize
await setBackground(0);
addEventListener('resize', applyFit, { passive: true });

// (Optional) If you want keyboard cycling while testing:
// addEventListener('keydown', e => { if (e.key === 'b') nextBackground(); });
