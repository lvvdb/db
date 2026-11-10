// Renders public/og.png (1200x630), public/logo.png (512x512) and
// public/apple-touch-icon.png (180x180) with Playwright. The PNGs are committed, so this
// only needs re-running when the brand art changes:  node scripts/make-brand-assets.mjs
// Requires Playwright (npx playwright install chromium) on the machine that runs it.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const font = (p) => pathToFileURL(path.join(root, 'node_modules/@fontsource-variable', p)).href;

const css = `
@font-face{font-family:Fraunces;src:url(${font('fraunces/files/fraunces-latin-opsz-normal.woff2')});font-weight:100 900}
@font-face{font-family:Fraunces;font-style:italic;src:url(${font('fraunces/files/fraunces-latin-opsz-italic.woff2')});font-weight:100 900}
@font-face{font-family:Sans;src:url(${font('instrument-sans/files/instrument-sans-latin-wght-normal.woff2')});font-weight:100 900}
*{box-sizing:border-box;margin:0}body{background:#0f2e29}`;

const mark = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="20" fill="#0f2e29"/>
  <path d="M9.5 22a10.5 10.5 0 0 1 21 0Z" fill="#f2703d"/>
  <path d="M7 26.5c3.25-2.4 6.5-2.4 9.75 0s6.5 2.4 9.75 0 4.3-2.2 6.5-1.3" fill="none" stroke="#fbf8f2" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M11.5 31c2.8-1.7 5.7-1.7 8.5 0s5.7 1.7 8.5 0" fill="none" stroke="#fbf8f2" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>
</svg>`;

const og = `<style>${css}
.og{position:relative;width:1200px;height:630px;overflow:hidden;background:#0f2e29;color:#fbf8f2;font-family:Sans;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
.glow{position:absolute;right:-180px;bottom:-320px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,#f79a5c 0 44%,rgba(247,154,92,.35) 45% 62%,rgba(247,154,92,.14) 63% 80%,transparent 81%)}
.brand{display:flex;align-items:center;gap:18px;font-family:Fraunces;font-size:38px;letter-spacing:-.02em}
.brand b{font-family:Sans;font-size:17px;letter-spacing:.18em;color:#f79a5c;font-weight:700}
h1{position:relative;font-family:Fraunces;font-weight:400;font-size:86px;line-height:1.02;letter-spacing:-.028em;max-width:820px}
h1 em{color:#f79a5c;font-weight:350}
p{position:relative;font-size:27px;color:rgba(251,248,242,.82);font-weight:500}
p span{color:#f79a5c;margin:0 14px}
</style>
<div class="og"><div class="glow"></div>
<div class="brand">${mark(64)}<span>Hormonal Health</span><b>MD</b></div>
<h1>Feel like yourself again, <em>starting with your labs.</em></h1>
<p>Hallandale Beach, FL<span>/</span>In clinic, online or at your door</p></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, 'public/og.png') });

for (const [file, size] of [['logo.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}body{background:#0f2e29;display:grid;place-items:center;height:100vh}</style>${mark(Math.round(size * 0.82))}`);
  await page.screenshot({ path: path.join(root, 'public', file) });
}
await browser.close();
console.log('wrote public/og.png, public/logo.png, public/apple-touch-icon.png');
