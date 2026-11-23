import puppeteer from 'puppeteer-core';

const origin = process.env.GE_SITE_URL || 'https://grandelement.com';
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const failures = [], warnings = [], checked = new Set();
const pages = ['/', '/radio/'];
for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('pageerror', e => failures.push('JS error: ' + e.message));
  for (const route of pages) {
    const url = new URL(route, origin).href;
    let response;
    try { response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }); }
    catch (e) { failures.push(url + ': navigation failed: ' + e.message); continue; }
    if (!response || response.status() >= 400) { failures.push(url + ': HTTP ' + (response?.status() ?? 'no response')); continue; }
    await new Promise(r => setTimeout(r, 1500));
    const result = await page.evaluate(() => {
      const visible = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
      const links = [...document.querySelectorAll('a[href]')].filter(visible).map(a => a.href);
      const controls = [...document.querySelectorAll('button, [role="button"]')].filter(visible);
      const dead = controls.filter(el => !el.disabled && !el.getAttribute('onclick') && !el.getAttribute('aria-label') && !el.textContent.trim() && !el.querySelector('svg,img,[title]')).length;
      const overflow = document.documentElement.scrollWidth > innerWidth + 12;
      return { links, dead, overflow, buttons: controls.length, title: document.title };
    });
    if (result.dead) warnings.push(url + ': ' + result.dead + ' unlabeled controls need review');
    if (result.overflow) warnings.push(url + ': horizontal overflow at ' + viewport.width + 'px');
    if (!result.buttons && route === '/radio/') warnings.push(url + ': no visible buttons found');
    for (const href of result.links) {
      const u = new URL(href);
      if (u.origin !== new URL(origin).origin || !['http:', 'https:'].includes(u.protocol) || checked.has(href)) continue;
      checked.add(href);
      try {
        const res = await fetch(href, { method: 'GET', signal: AbortSignal.timeout(12000), redirect: 'follow' });
        if (res.status >= 400) failures.push('Broken internal link: ' + href + ' (' + res.status + ')');
      } catch (e) { warnings.push('Could not verify link: ' + href + ' (' + e.message + ')'); }
    }
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ checkedLinks: checked.size, failures, warnings }, null, 2));
if (failures.length) process.exitCode = 1;
