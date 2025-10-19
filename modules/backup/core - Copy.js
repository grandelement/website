// modules/core.js
// --- utilities shared by all modules ---
export const $  = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp  = (a, b, t) => a + (b - a) * t;

// Media helpers
export const isMobile = () => matchMedia('(max-width: 900px), (pointer: coarse)').matches;

// CSS var helpers (we set vars on :root so everything can read them)
export function setVars(map) {
  const root = document.documentElement;
  for (const k in map) {
    root.style.setProperty(k, map[k]);
  }
}
export const applySizes = setVars; // alias used by other modules

// Tiny event bus so modules can wait for each other if needed
const listeners = new Set();
export function onReady(fn){ listeners.add(fn); if (document.readyState !== 'loading') fn(); }
export function signalReady(){ listeners.forEach(fn => fn()); }

// Small guard to log module boot status in your HUD
export function modOK(name){ console.debug(`[OK] ${name}`); }
export function modFAIL(name, e){ console.error(`[FAIL] ${name}`, e); throw e; }
