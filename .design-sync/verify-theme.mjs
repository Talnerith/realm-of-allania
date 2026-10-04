// Theme verification for the synced design system (run after a build):
//   node .design-sync/verify-theme.mjs
// Renders ThreadView + CharacterDrawer full-page from ds-bundle/ in every
// theme × accent at 390px and 1440px and checks:
//   - no horizontal overflow (scrollWidth === clientWidth, page and thread)
//   - the editor toolbar's format buttons and actions aren't clipped
//   - visible text contrast >= 4.5:1 against its effective background
// Exits 1 on any failure.
import { createRequire } from 'module';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const bundle = join(root, 'ds-bundle');
const require = createRequire(join(root, '.ds-sync', 'package.json'));
const { chromium } = require('playwright');

// Full-page harness (dot-free name but never uploaded: not in the upload plan)
writeFileSync(join(bundle, '_verify.html'), `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="styles.css"><style>html,body{margin:0}</style></head><body>
<div id="root"></div>
<script src="_vendor/react.js"></script><script src="_vendor/react-dom.js"></script><script src="_ds_bundle.js"></script>
<script>
  var p = new URLSearchParams(location.search), A = window.Allania, h = React.createElement;
  ReactDOM.createRoot(document.getElementById('root')).render(
    h(A.AllaniaProvider, { theme: p.get('theme'), accent: p.get('accent') },
      h('div', { className: 'h-screen flex flex-col bg-ink-950' },
        h(A.ThreadView, { thread: { id: 't-ember', title: 'Smoke over the Ember Road' }, region: { id: 125, name: 'Thornwatch Ridge' } })),
      h(A.CharacterDrawer)));
</script></body></html>`);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const file = join(bundle, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(bundle) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const port = server.address().port;

// Runs in the page
function audit() {
  const out = { overflow: [], clipped: [], contrast: [] };
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth) out.overflow.push(`page ${doc.scrollWidth} > ${doc.clientWidth}`);
  const thread = document.querySelector('.overflow-y-auto');
  if (thread && thread.scrollWidth > thread.clientWidth) out.overflow.push(`thread ${thread.scrollWidth} > ${thread.clientWidth}`);

  const textarea = document.querySelector('textarea');
  const toolbar = textarea?.closest('.rounded-xl')?.firstElementChild;
  if (toolbar) {
    const bar = toolbar.getBoundingClientRect();
    const group = toolbar.firstElementChild;
    if (group.scrollWidth > group.clientWidth + 1) out.clipped.push(`format buttons scroll (${group.scrollWidth} > ${group.clientWidth})`);
    const g = group.getBoundingClientRect();
    group.querySelectorAll('button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.left < g.left - 0.5 || r.right > g.right + 0.5) out.clipped.push(`${b.title || b.textContent} outside its group`);
    });
    toolbar.lastElementChild.querySelectorAll('button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.left < bar.left - 0.5 || r.right > bar.right + 0.5) out.clipped.push(`${b.getAttribute('aria-label') || b.textContent} outside the toolbar`);
    });
  } else out.clipped.push('editor toolbar not found');

  // Color parsing via canvas (handles oklch / color-mix / lab)
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255];
  };
  const over = (top, under) => top.slice(0, 3).map((c, i) => c * top[3] + under[i] * (1 - top[3]));
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const background = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let bg = [255, 255, 255];
    for (const layer of layers.reverse()) bg = over(layer, bg);
    return bg;
  };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!t.textContent.trim() || seen.has(el) || el.closest('[aria-hidden="true"], script, style, [data-skel], :disabled')) continue;
    seen.add(el);
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || r.width === 0 || r.height === 0 || Number(cs.opacity) < 0.1) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue; // off-screen in the scroller
    const fg = over(rgba(cs.color), background(el));
    const bg = background(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 4.5) out.contrast.push(`${ratio.toFixed(2)}:1 "${t.textContent.trim().slice(0, 40)}" (${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')})`);
  }
  return out;
}

const browser = await chromium.launch();
let failures = 0;
for (const width of [390, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const theme of ['dark', 'light']) {
    for (const accent of ['ember', 'brass', 'verdigris']) {
      await page.goto(`http://127.0.0.1:${port}/_verify.html?theme=${theme}&accent=${accent}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelectorAll('textarea').length && document.body.textContent.includes('Lyra dropped'), null, { timeout: 10000 });
      await page.waitForTimeout(800); // entrance animations settle
      const r = await page.evaluate(audit);
      const issues = [...r.overflow.map((x) => `overflow: ${x}`), ...r.clipped.map((x) => `toolbar: ${x}`), ...r.contrast.map((x) => `contrast: ${x}`)];
      failures += issues.length;
      console.log(`${issues.length ? '✗' : '✓'} ${width}px ${theme} ${accent}${issues.length ? '\n    ' + issues.join('\n    ') : ''}`);
    }
  }
  await page.close();
}
await browser.close();
server.close();
console.log(failures ? `\n${failures} issue(s)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
