/**
 * GE Radio: one source of truth for player button dimensions and active states.
 * Runs with stock Node.js. No external dependencies.
 * Keep size tokens in radio-base.css between the contract markers.
 * Other CSS may position controls, but must not resize or recolor Shuffle ON.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const files = [
  'radio/radio-base.css',
  'ge-accessibility.css',
  'radio/radio-components.css',
  'radio/radio-layout.css',
  'radio/player-button-effects.css',
  'radio/player-mobile-fit.css',
];
const cssFiles = Object.fromEntries(
  files.map(name => [name, readFileSync(resolve(root, name), 'utf8')])
);
const html = readFileSync(resolve(here, 'index.html'), 'utf8');
const errors = [];
const startMark = '/* GE RADIO CONTROL CONTRACT';
const endMark = '/* END GE RADIO CONTROL CONTRACT */';
const base = cssFiles['radio/radio-base.css'];
const start = base.indexOf(startMark), end = base.indexOf(endMark);
if (start < 0 || end <= start || base.indexOf(startMark, start + 1) >= 0 ||
    base.indexOf(endMark, end + 1) >= 0) {
  errors.push('Canonical control contract must appear exactly once in radio-base.css');
}
const contract = start >= 0 && end > start ? base.slice(start, end) : '';
const sourceCSS = { ...cssFiles };
if (contract) sourceCSS['radio/radio-base.css'] = base.slice(0, start) + base.slice(end + endMark.length);

const controlSelector = /#musicGroup\s*(?:>| )\s*(?:button|:is\(#|#(?:prevBtn|playBtn|nextBtn|shuffleBtn|liveBtn|geMusicV5Button))|#bgGroup(?:\s+\.bg-row)?\s*(?:>| )\s*(?:button|#hudCombined|:is\(button|:is\(#hudCombined)|#bgGroup\s+#hudCombined|#bottomActions\s*(?:>| )\s*(?:button|:is\(button|:is\(#(?:access|contact|share)|\*|\[data-ge-symbol\])|#bottomActions\s+button|#geDesktopUtilityStrip\s+:is\(#bgGroup \.bg-row,#bottomActions,#geUtilityRow\)\s*>\s*:is\(|#geDesktopUtilityStrip\s+#bgGroup\s+\.bg-row\s*>\s*\*/;
const forbiddenSize = /\b(?:min-height|max-height|height|font-size|padding(?:-inline|-left|-right|-top|-bottom)?|line-height)\s*:\s*[^;{}]+;?/gi;

for (const [name, css] of Object.entries(sourceCSS)) {
  const lines = pos => css.slice(0, pos).split('\n').length;
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
    const body = match[2];
    if (/iam-studio-open(?!\))|view-ship|shipStage|::before|::after|#geRadioWakeLink|#liveStatus/.test(selector)) continue;
    if (controlSelector.test(selector)) {
      for (const prop of body.matchAll(forbiddenSize)) {
        if (selector.includes('[data-ge-symbol]') &&
            /^font-size\s*:\s*0\s*!important/i.test(prop[0])) continue;
        errors.push(name + ':' + lines(match.index) + ' has conflicting ' + prop[0].trim() + ' in ' + selector.slice(-85));
      }
      if (/#bgGroup\s+#hudCombined\s+input/.test(selector) &&
          /\b(?:width|min-width|flex|accent-color)\s*:/.test(body)) {
        errors.push(name + ':' + lines(match.index) + ' overrides the Hide Text checkbox dimensions');
      }
    }
    const rowLayout = /#musicGroup|#bgGroup\s+\.bg-row|#bottomActions/.test(selector);
    const isControlChild = /#musicGroup\s*>\s*(?:button|#)|#bgGroup\s+\.bg-row\s*>\s*(?:button|#)|#bottomActions\s*>\s*(?:button|#)/.test(selector);
    if (rowLayout && !isControlChild &&
        /grid-(?:template|auto)-rows\s*:[^;{}]*\d+px/.test(body)) {
      errors.push(name + ':' + lines(match.index) + ' has a fixed radio control grid row');
    }
  }
}
for (const token of ['--ge-radio-music-height:', '--ge-radio-secondary-height:',
    '--ge-radio-checkbox-size:28px', '--ge-radio-music-font:',
    '--ge-radio-secondary-font:', '#hudCombined.ge-auto-hide-on',
    '#shuffleBtn[aria-pressed="true"]']) {
  if (!contract.includes(token)) errors.push('Canonical contract missing ' + token);
}
for (const snippet of ["setPressed(toggle,!!state.shuffle)",
    "combined.classList.toggle('ge-auto-hide-on',autoEnabled)"]) {
  if (!html.includes(snippet)) errors.push('Radio state wiring missing: ' + snippet);
}
if (html.includes('setPressed(toggle,false)')) errors.push('Shuffle mode must not be forced to false');
if (!cssFiles['ge-accessibility.css'].includes('var(--ge-radio-symbol-font,12px)'))
  errors.push('Symbol caption text must inherit control size tokens');
if (cssFiles['radio/player-button-effects.css'].includes('#shuffleBtn[aria-pressed="true"]'))
  errors.push('Effects stylesheet must not override the green Shuffle ON state');
for (const path of files) {
  const shortName = path.startsWith('radio/') ? path.slice(6) : '../' + path;
  if (path === 'radio/radio-base.css') continue;
  if (!html.includes(shortName)) errors.push('Radio page no longer includes checked stylesheet ' + shortName);
}

if (errors.length) {
  console.error('GE Radio control contract failed (' + errors.length + ' issues):\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('GE Radio control contract OK: one sizing source, no conflicting linked stylesheets, active states wired.');
}
