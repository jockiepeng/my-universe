import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const shots = path.resolve('.tools/screenshots');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname.slice(base.length).replace(/^\/+/, '');
  const file = path.resolve(dist, relative, pathname.endsWith('/') ? 'index.html' : '');
  if (!pathname.startsWith(`${base}/`) || !file.startsWith(`${dist}${path.sep}`)) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Try next browser. */ }
}
const origin = `http://127.0.0.1:${server.address().port}`;
const url = route => `${origin}${base}${route}`;
const browser = await chromium.launch({ executablePath: executable, headless: true, args: ['--enable-unsafe-swiftshader'] });
await mkdir(shots, { recursive: true });
const errors = [];
const untranslated = [];

async function ready(page, route) {
  await page.goto(url(route));
  await page.waitForFunction(() => document.documentElement.dataset.languageReady === 'true');
  await page.locator('[data-entry-skip]').evaluateAll(elements => elements.forEach(el => { if (el.getClientRects().length) el.click(); }));
}
async function audit(page, route) {
  const missing = await page.evaluate(() => {
    const skip = 'script,style,noscript,textarea,[data-i18n-ignore],[data-i18n-skip],[translate="no"]';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const missing = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest(skip) && /\p{Script=Han}/u.test(node.textContent)) missing.push(node.textContent.trim());
    }
    for (const node of document.querySelectorAll('[aria-label],[aria-roledescription],[title],[placeholder],[alt]')) {
      if (node.closest(skip)) continue;
      for (const attr of ['aria-label', 'aria-roledescription', 'title', 'placeholder', 'alt']) {
        const text = node.getAttribute(attr);
        // Photo descriptions are editorial, but their UI prefix is localized.
        if (text && /\p{Script=Han}/u.test(text) && !node.closest('.u-photo-carousel')) missing.push(`${attr}: ${text}`);
      }
    }
    return [...new Set(missing)];
  });
  if (missing.length) untranslated.push({ route, missing });
}

try {
  const opening = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await opening.addInitScript(() => {
    localStorage.setItem('little-universe-language-v1', 'en');
    localStorage.setItem('little-universe-appearance-v1', JSON.stringify({ scene: 'galaxy', opening: 'particles', selectionDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()) }));
    window.__entryTitles = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (String(text).includes('小宇宙') || String(text).includes('universe')) window.__entryTitles.push(String(text));
      return original.call(this, text, ...args);
    };
  });
  const entryPage = await opening.newPage();
  await entryPage.goto(url('/'));
  await entryPage.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
  assert.ok(await entryPage.evaluate(() => window.__entryTitles.length > 0), 'Particle opening drew its title');
  assert.deepEqual(await entryPage.evaluate(() => window.__entryTitles.filter(text => /\p{Script=Han}/u.test(text))), [], 'English first-load particles use English text');
  await opening.close();

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__posterTexts = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (this.canvas.width === 1600 && this.canvas.height === 2400) window.__posterTexts.push(String(text));
      return fill.call(this, text, ...args);
    };
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await ready(page, '/');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
  const titles = await page.locator('.u-post h3').allTextContents();
  await page.locator('[data-language-toggle]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('.u-nav').innerText(), 'Home\nArchive\nGames\nTools\nAbout');
  assert.deepEqual(await page.locator('.u-post h3').allTextContents(), titles);
  assert.equal(await page.locator('[data-language-toggle]').innerText(), '中文');
  await page.locator('[data-filter="photo"]').click();
  assert.match(await page.locator('[data-filter-count]').innerText(), /^\d+ posts$/);
  await page.locator('[data-clock-toggle]').click();
  assert.match(await page.locator('[data-calendar-month]').innerText(), /\w+ \d{4}/);
  await page.locator('[data-calendar-next]').click();
  await audit(page, '/calendar');
  await page.locator('[data-clock-toggle]').click();
  await page.screenshot({ path: path.join(shots, 'english-home-desktop.png') });
  await ready(page, '/archive/');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.languageReady === 'true');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.locator('[data-language-toggle]').click();
  assert.equal(await page.locator('h1').innerText(), '时间留下的轨迹');
  await ready(page, '/posts/how-i-built-my-blog/');
  const article = await page.locator('.u-article-body').innerHTML();
  const articleTitle = await page.locator('.u-article-head h1').innerText();
  await page.locator('[data-language-toggle]').click();
  assert.equal(await page.locator('.u-article-body').innerHTML(), article);
  assert.equal(await page.locator('.u-article-head h1').innerText(), articleTitle);
  assert.match(await page.locator('.u-meta').first().innerText(), /Created/);
  await page.locator('[data-search-open]').click();
  await page.locator('#search-input').fill('Snake');
  await page.waitForFunction(() => document.querySelector('[data-search-results]')?.textContent?.includes('Snake'));
  await audit(page, '/search/Snake');
  await page.locator('#search-input').fill('人生');
  await page.waitForFunction(() => document.querySelector('[data-search-results] a[href*="/tools/life/"]'));
  await audit(page, '/search/life');
  const peer = await context.newPage();
  await ready(peer, '/about/');
  await peer.locator('[data-language-toggle]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
  assert.equal(await page.locator('#site-search').evaluate(dialog => dialog.open), true);
  assert.equal(await page.locator('#search-input').inputValue(), '人生');
  assert.match(await page.locator('[data-search-results] a[href*="/tools/life/"] p').innerText(), /人生/);
  await peer.locator('[data-language-toggle]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await audit(page, '/search/life/language-round-trip');
  await peer.close();
  await page.locator('[data-search-close]').click();

  await ready(page, '/games/dice/');
  await page.locator('[data-spot="small"]').click();
  const stake = await page.locator('[data-stake]').innerText();
  await page.locator('[data-language-toggle]').click();
  assert.equal(await page.locator('[data-stake]').innerText(), stake);
  await page.locator('[data-language-toggle]').click();
  await page.locator('[data-roll]').click();
  await page.waitForFunction(() => document.querySelector('[data-history-count]').textContent.startsWith('1'));
  await audit(page, '/games/dice/after-roll');

  await ready(page, '/games/minesweeper/');
  await page.locator('[data-mines-board] button').first().click();
  const revealed = await page.locator('[data-mines-board] [data-revealed="true"]').count();
  assert.ok(revealed > 0);
  await page.locator('[data-language-toggle]').click();
  await page.locator('[data-language-toggle]').click();
  assert.equal(await page.locator('[data-mines-board] [data-revealed="true"]').count(), revealed);
  await audit(page, '/games/minesweeper/playing');

  await ready(page, '/tools/fortune/');
  await page.locator('[data-draw]').click();
  await page.locator('[data-reveal]').click();
  const lot = await page.locator('[data-result-number]').innerText();
  const poem = await page.locator('[data-result-poem]').innerText();
  assert.doesNotMatch(poem, /\p{Script=Han}/u);
  await page.locator('[data-language-toggle]').click();
  assert.match(await page.locator('[data-result-poem]').innerText(), /\p{Script=Han}/u);
  await page.locator('[data-language-toggle]').click();
  assert.equal(await page.locator('[data-result-number]').innerText(), lot);
  assert.equal(await page.locator('[data-result-poem]').innerText(), poem);
  assert.equal(await page.locator('[data-fortune]').getAttribute('data-phase'), 'revealed');
  await audit(page, '/tools/fortune/revealed');
  await page.screenshot({ path: path.join(shots, 'english-fortune-desktop.png'), fullPage: true });

  for (const route of ['/tools/life/', '/tools/life-replay/']) {
    await ready(page, route);
    await page.locator('[name="birth"]').fill('1990-01-01');
    await page.locator('[name="lifespan"]').fill('85');
    await page.locator('[data-life-form] button[type="submit"]').click();
    await page.locator('[data-life-unit="week"]').click();
    await page.locator('[data-life-wish]').fill('首页');
    await page.locator('[data-language-toggle]').click();
    await page.locator('[data-language-toggle]').click();
    assert.equal(await page.locator('[name="birth"]').inputValue(), '1990-01-01');
    assert.equal(await page.locator('[name="lifespan"]').inputValue(), '85');
    assert.equal(await page.locator('[data-life-wish]').inputValue(), '首页');
    await page.locator('[data-life-share-open]').click();
    await page.waitForFunction(() => document.querySelector('[data-life-share-dialog]').dataset.ready === 'true');
    assert.match(await page.locator('[data-life-poster-summary]').innerText(), /首页$/);
    assert.deepEqual(await page.evaluate(() => window.__posterTexts.filter(text => /\p{Script=Han}/u.test(text) && text !== '首页')), [], 'PNG UI is English and the user wish stays original');
    assert.ok(await page.evaluate(() => window.__posterTexts.includes('首页')));
    await audit(page, `${route}export`);
    await page.locator('[data-life-poster]').screenshot({ path: path.join(shots, route.includes('replay') ? 'english-replay-poster.png' : 'english-life-poster.png') });
    const png = await page.locator('[data-life-poster]').evaluate(async image => Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())));
    await writeFile(path.join(shots, route.includes('replay') ? 'english-replay-export.png' : 'english-life-export.png'), Buffer.from(png));
    await page.locator('[data-life-share-close]').click();
  }

  const files = await readdir(dist, { recursive: true });
  const routes = files.filter(file => file.endsWith('index.html')).map(file => '/' + file.replaceAll('\\', '/').replace(/index.html$/, ''));
  routes.push('/404.html');
  for (const route of routes) {
    await ready(page, route);
    await audit(page, route);
  }

  // New text and attributes written by existing scripts must stay localized.
  await page.evaluate(() => {
    const status = document.createElement('p'); status.id = 'locale-probe'; status.textContent = '显示 12 篇'; status.title = '返回首页'; document.body.append(status);
  });
  await page.waitForFunction(() => document.querySelector('#locale-probe').textContent === '12 posts');
  assert.equal(await page.locator('#locale-probe').getAttribute('title'), 'Back to home');
  await page.locator('[data-language-toggle]').click();
  assert.equal(await page.locator('#locale-probe').innerText(), '显示 12 篇');
  await page.locator('[data-language-toggle]').click();

  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/about/', '/games/dice/', '/games/2048/', '/games/minesweeper/', '/games/link/', '/tools/', '/tools/life/', '/tools/life-replay/', '/tools/fortune/']) {
      await ready(page, route);
      assert.ok(await page.locator('[data-language-toggle]').isVisible(), `language switch visible at ${width}: ${route}`);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(overflow.page <= overflow.viewport + 1, `${width} ${route} overflows: ${JSON.stringify(overflow)}`);
    }
    if (width === 390) { await ready(page, '/'); await page.screenshot({ path: path.join(shots, 'english-home-mobile.png') }); }
  }

  const blocked = await browser.newContext({ reducedMotion: 'reduce' });
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } }); });
  const noStorage = await blocked.newPage();
  await ready(noStorage, '/about/');
  await noStorage.locator('[data-language-toggle]').click();
  assert.equal(await noStorage.locator('h1').innerText(), 'About');
  await noStorage.locator('[data-language-toggle]').click();
  assert.equal(await noStorage.locator('h1').innerText(), '关于我');
  await blocked.close();
  await writeFile('.tools/i18n-untranslated.json', JSON.stringify(untranslated, null, 2));
  assert.equal(untranslated.length, 0, `${untranslated.length} routes have untranslated UI; see .tools/i18n-untranslated.json`);
  assert.deepEqual(errors, [], 'No browser errors');
  console.log(`PASS: ${routes.length} routes; language persistence, original articles, search, dynamic updates, blocked storage and four viewport widths.`);
} finally {
  await writeFile('.tools/i18n-untranslated.json', JSON.stringify(untranslated, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
