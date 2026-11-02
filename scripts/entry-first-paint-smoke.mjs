import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname.slice(base.length).replace(/^\/+/, '');
  const file = path.resolve(dist, relative, pathname.endsWith('/') ? 'index.html' : '');
  if (!pathname.startsWith(`${base}/`) || !file.startsWith(`${dist}${path.sep}`)) {
    res.writeHead(404).end(); return;
  }
  try {
    const contentType = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${base}/`;
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Try the next browser. */ }
}
const browser = await chromium.launch({ executablePath: executable, headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  // Returning home must select the right scene even while module downloads stall.
  for (const source of ['archive/', 'games/']) {
    for (const scenario of [
      { name: 'daily', stored: null, scene: 'ocean', opening: 'portal' },
      { name: 'manual', stored: JSON.stringify({ scene: 'aurora', opening: 'particles', selectionDate: '2026-11-03', theme: 'dark', motion: false }), scene: 'aurora', opening: 'particles' },
      { name: 'expired', stored: JSON.stringify({ scene: 'aurora', opening: 'particles', selectionDate: '2026-11-02' }), scene: 'ocean', opening: 'portal' },
      { name: 'malformed', stored: '{', scene: 'ocean', opening: 'portal' },
      { name: 'unavailable', stored: null, scene: 'ocean', opening: 'portal' },
    ]) {
      const context = await browser.newContext();
      await context.addInitScript(({ stored, unavailable, base }) => {
        if (stored !== null) localStorage.setItem('little-universe-appearance-v1', stored);
        sessionStorage.setItem(`universe-entry-v1:${base}/`, '2026-11-03');
        if (unavailable) {
          const getItem = Storage.prototype.getItem;
          Storage.prototype.getItem = function (key) {
            if (key === 'little-universe-appearance-v1') throw new Error('Storage unavailable');
            return getItem.call(this, key);
          };
        }
      }, { stored: scenario.stored, unavailable: scenario.name === 'unavailable', base });
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-11-03T04:00:00Z') });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let resume;
      const scriptsReady = new Promise(resolve => { resume = resolve; });
      try {
        await page.goto(`${url}${source}`);
        await page.route('**/*.js', async route => { await scriptsReady; await route.continue(); });
        await page.locator('.u-nav a').first().click({ noWaitAfter: true });
        await page.waitForURL(url, { waitUntil: 'commit' });
        await page.locator('[data-home-scene]').waitFor({ state: 'attached' });
        const inspect = () => ({
          scene: document.documentElement.dataset.scene,
          opening: document.documentElement.dataset.opening,
          theme: document.documentElement.dataset.theme,
          motion: document.documentElement.dataset.motion,
          background: getComputedStyle(document.querySelector('.u-home-scene')).backgroundImage,
        });
        const before = await page.evaluate(inspect);
        assert.equal(before.scene, scenario.scene, `${source} ${scenario.name}: correct scene before modules load`);
        assert.equal(before.opening, scenario.opening, `${source} ${scenario.name}: correct opening before modules load`);
        assert.equal(await page.locator('.u-page').isVisible(), true, 'Returning home does not replay the opening');
        resume();
        await page.waitForLoadState('load');
        await page.waitForFunction(() => document.querySelector('[data-home-scene]').dataset.renderer);
        assert.deepEqual(await page.evaluate(inspect), before, 'Module startup must preserve the initial appearance');
        assert.deepEqual(errors, []);
        console.log(`PASS: ${source} ${scenario.name} scene stays correct before and after module startup`);
      } finally { resume(); await context.close(); }
    }
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  let release;
  const scriptsReady = new Promise(resolve => { release = resolve; });
  await page.route('**/*.js', async route => { await scriptsReady; await route.continue(); });
  try {
    await page.goto(url, { waitUntil: 'commit' });
    await page.locator('.u-page').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.u-page').isVisible(), false, '正文在开场脚本下载期间不能先闪现');
    assert.equal(await page.locator('[data-entry-gate]').isVisible(), true, '脚本下载期间先显示开场');
    await mkdir('.tools/screenshots', { recursive: true });
    await page.screenshot({ path: '.tools/screenshots/entry-before-scripts.png' });
    release();
    await page.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
    assert.equal(await page.locator('.u-page').isVisible(), false);
    await page.locator('[data-entry-skip]').click();
    assert.equal(await page.locator('.u-page').isVisible(), true);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
    assert.equal(await page.locator('[data-entry-gate]').isVisible(), false, '同一天刷新直接进入正文');
    console.log('PASS: 开场先于正文显示，慢脚本无正文闪现，进入后当天不重播');
  } finally { release(); await context.close(); }

  for (const action of ['skip', 'timeout', 'anchor']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let resume;
    const scriptsReady = new Promise(resolve => { resume = resolve; });
    await page.route('**/*.js', async route => { await scriptsReady; await route.continue(); });
    try {
      if (action === 'timeout') await page.clock.install();
      await page.goto(`${url}${action === 'anchor' ? '#main-content' : ''}`, { waitUntil: 'commit' });
      await page.locator('.u-page').waitFor({ state: 'attached' });
      if (action !== 'anchor') {
        assert.equal(await page.locator('.u-page').isVisible(), false);
        if (action === 'skip') await page.locator('[data-entry-skip]').click();
        else await page.clock.fastForward(8100);
      }
      assert.equal(await page.locator('.u-page').isVisible(), true, `${action}: 无需等待模块也可进入正文`);
      assert.equal(await page.locator('[data-entry-gate]').isVisible(), false);
      resume();
      await page.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
      assert.equal(await page.locator('.u-page').isVisible(), true, `${action}: 迟到的模块不能重新遮住正文`);
      assert.equal(await page.locator('[data-entry-gate]').isVisible(), false);
      console.log(`PASS: ${action} 正常进入正文，迟到的动画脚本不会打断阅读`);
    } finally { resume(); await context.close(); }
  }
} finally { await browser.close(); server.close(); }
