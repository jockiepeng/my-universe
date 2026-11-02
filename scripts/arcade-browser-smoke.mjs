import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';
import { findPair } from '../src/lib/link-game.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const screenshots = path.resolve('.tools/screenshots');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(dist, pathname.slice(base.length).replace(/^\/+/, ''), pathname.endsWith('/') ? 'index.html' : '');
    if ((base && !pathname.startsWith(base + '/')) || !file.startsWith(dist + path.sep)) throw new Error('path');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const gameUrl = slug => `${origin}${base}/games/${slug}/`;
const slugs = ['snake', 'minesweeper', 'breakout', 'link'];
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Try the next installed browser. */ }
}
if (!executable) { server.close(); throw new Error('Set BROWSER_PATH to Chrome or Chromium.'); }
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ executablePath: executable, headless: true });
const errors = [];
async function ready(page, slug) {
  await page.waitForSelector(`[data-arcade="${slug}"][data-ready="true"]`);
}
async function createContext(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1100 }, reducedMotion: 'reduce', colorScheme: 'light', ...options });
  ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return ctx;
}
async function screenshot(page, name) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshots, name), fullPage: true });
}

try {
  const context = await createContext();
  const page = await context.newPage();
  await page.goto(`${origin}${base}/games/`);
  assert.equal(await page.locator('.g-game-card').count(), 6, 'lobby should contain six playable games');
  for (const slug of ['dice', '2048', ...slugs]) assert.equal(await page.locator(`.g-game-card[href="${base}/games/${slug}/"]`).count(), 1);
  await screenshot(page, 'arcade-lobby-desktop.png');
  for (const slug of slugs) {
    await page.goto(`${origin}${base}/games/`);
    await page.locator(`.g-game-card[href="${base}/games/${slug}/"]`).click();
    await ready(page, slug);
    assert.equal(await page.locator('.u-nav [aria-current="page"]').textContent(), '游戏');
    assert.equal(await page.locator('.a-guide').isVisible(), true);
    if (slug === 'link') assert.ok(await page.locator('[data-link-cell]').first().evaluate(cell => parseFloat(getComputedStyle(cell).fontSize) >= 24), 'link icons should be large enough to distinguish');
    await screenshot(page, `arcade-${slug}-desktop.png`);
  }

  const play = await context.newPage();
  await play.clock.install({ time: new Date('2026-11-02T12:00:00Z') });
  await play.clock.pauseAt(new Date('2026-11-02T12:00:01Z'));
  const phase = slug => play.locator(`[data-arcade="${slug}"]`).getAttribute('data-status');
  const pixels = selector => play.locator(selector).evaluate(canvas => canvas.toDataURL());

  await play.goto(gameUrl('snake')); await ready(play, 'snake');
  await play.locator('[data-snake-start]').click();
  assert.equal(await phase('snake'), 'playing');
  const snakeStart = await play.locator('[data-snake-canvas]').getAttribute('aria-label');
  await play.clock.runFor(150);
  assert.notEqual(await play.locator('[data-snake-canvas]').getAttribute('aria-label'), snakeStart, 'snake should advance');
  await play.keyboard.press('ArrowUp'); await play.keyboard.press('ArrowLeft');
  await play.clock.runFor(250);
  assert.equal(await phase('snake'), 'playing', 'rapid turns must not reverse into the neck');
  await play.locator('[data-snake-pause]').click();
  assert.equal(await phase('snake'), 'paused');
  const snakePause = await pixels('[data-snake-canvas]');
  await play.clock.runFor(1500);
  assert.equal(await pixels('[data-snake-canvas]'), snakePause);
  await play.locator('[data-snake-pause]').click();
  await play.clock.runFor(140);
  await play.evaluate(() => dispatchEvent(new Event('blur')));
  assert.equal(await phase('snake'), 'paused');
  await play.locator('[data-snake-new]').click();
  assert.equal(await phase('snake'), 'ready');
  assert.equal(await play.locator('[data-snake-score]').textContent(), '0');
  await play.locator('[data-snake-speed]').selectOption('fast');
  await play.locator('[data-snake-board]').focus(); await play.keyboard.press('Enter');
  await play.clock.runFor(1000);
  assert.equal(await phase('snake'), 'over', 'an unattended snake should hit the wall');
  await play.evaluate(() => localStorage.setItem('my-universe:snake:best:normal:v1', '70'));
  await play.reload(); await ready(play, 'snake');
  assert.equal(await play.locator('[data-snake-best]').textContent(), '70', 'saved record survives reload');

  await play.goto(gameUrl('breakout')); await ready(play, 'breakout');
  const docked = await pixels('[data-breakout-canvas]');
  await play.locator('[data-breakout-canvas]').focus();
  await play.keyboard.down('ArrowLeft'); await play.clock.runFor(150); await play.keyboard.up('ArrowLeft');
  assert.notEqual(await pixels('[data-breakout-canvas]'), docked, 'keyboard should move the waiting paddle and ball');
  await play.locator('[data-breakout-start]').click();
  await play.clock.runFor(300);
  assert.equal(await phase('breakout'), 'running');
  await play.locator('[data-breakout-pause]').click();
  const brickPause = await pixels('[data-breakout-canvas]');
  await play.clock.runFor(2000);
  assert.equal(await phase('breakout'), 'paused');
  assert.equal(await pixels('[data-breakout-canvas]'), brickPause);
  await play.locator('[data-breakout-start]').click();
  await play.clock.runFor(200);
  await play.evaluate(() => dispatchEvent(new Event('blur')));
  assert.equal(await phase('breakout'), 'paused');
  await play.locator('[data-breakout-new]').click();
  assert.equal(await phase('breakout'), 'ready');
  assert.equal(await play.locator('[data-breakout-lives]').textContent(), '3');
  await play.evaluate(() => localStorage.setItem('my-universe.breakout.best.v1', '120'));
  await play.reload(); await ready(play, 'breakout');
  assert.equal(await play.locator('[data-breakout-best]').textContent(), '120');

  await play.goto(gameUrl('minesweeper')); await ready(play, 'minesweeper');
  assert.equal(await play.locator('[data-mines-cell]').count(), 81);
  await play.locator('[data-mines-flag]').click();
  await play.locator('[data-mines-cell="0"]').click();
  assert.equal(await play.locator('[data-mines-cell="0"]').getAttribute('data-flagged'), 'true');
  assert.equal(await phase('minesweeper'), 'ready', 'flags cannot start the timer');
  await play.locator('[data-mines-flag]').click();
  await play.locator('[data-mines-cell="40"]').click();
  assert.equal(await play.locator('[data-mines-cell="40"]').getAttribute('data-revealed'), 'true');
  assert.equal(await play.locator('[data-mines-cell="40"]').getAttribute('data-number'), '0');
  assert.equal(await play.locator('[data-mines-cell="0"]').getAttribute('data-revealed'), 'false');
  assert.equal(await phase('minesweeper'), 'playing');
  await play.clock.runFor(2200);
  assert.equal(await play.locator('[data-mines-time]').textContent(), '2');
  await play.locator('[data-mines-pause]').click();
  const mineTime = await play.locator('[data-mines-time]').textContent();
  await play.clock.runFor(3000);
  assert.equal(await play.locator('[data-mines-time]').textContent(), mineTime);
  assert.equal(await play.locator('[data-mines-cover]').isVisible(), true);
  await play.locator('[data-mines-pause]').click();
  await play.locator('[data-mines-restart]').click();
  assert.equal(await phase('minesweeper'), 'ready');
  await play.locator('[data-mines-cell="0"]').focus();
  await play.keyboard.press('ArrowRight'); await play.keyboard.press('f');
  assert.equal(await play.locator('[data-mines-cell="1"]').getAttribute('data-flagged'), 'true');
  await play.locator('[data-mines-difficulty]').selectOption('hard');
  assert.equal(await play.locator('[data-mines-cell]').count(), 256);
  await play.locator('[data-mines-restart]').click();
  assert.equal(await play.locator('[data-mines-time]').textContent(), '0');

  await play.goto(gameUrl('link')); await ready(play, 'link');
  assert.equal(await play.locator('[data-link-cell]').count(), 36);
  await play.locator('[data-link-start]').click();
  await play.locator('[data-link-hint]').click();
  assert.equal(await play.locator('[data-link-cell][data-hint="true"]').count(), 2);
  const linkBoard = await play.locator('[data-link-cell]').evaluateAll(cells => ({ rows: 6, cols: 6, tiles: cells.map(cell => cell.dataset.empty === 'true' ? null : Number(cell.dataset.value)) }));
  const pair = findPair(linkBoard); assert.ok(pair);
  await play.locator(`[data-link-cell="${pair.first}"]`).click();
  await play.locator(`[data-link-cell="${pair.second}"]`).click();
  assert.equal(await play.locator('[data-link-cell][data-empty="true"]').count(), 2);
  assert.equal(await play.locator('[data-link-score]').textContent(), '100');
  assert.equal(await play.locator('[data-link-best]').textContent(), '100', 'highest score updates during the round');
  assert.notEqual(await play.locator('[data-link-line]').getAttribute('points'), '');
  await play.clock.runFor(450);
  await play.locator('[data-link-pause]').click();
  const linkTime = await play.locator('[data-link-time]').textContent();
  await play.clock.runFor(4000);
  assert.equal(await play.locator('[data-link-time]').textContent(), linkTime);
  assert.equal(await play.locator('[data-link-cover]').isVisible(), true);
  await play.locator('[data-link-pause]').click();
  await play.locator('[data-link-shuffle]').click();
  assert.equal(await play.locator('[data-link-cell][data-empty="true"]').count(), 2);
  assert.equal(await play.locator('[data-link-shuffle]').textContent(), '洗牌 · 2');
  await play.locator('[data-link-restart]').click();
  assert.equal(await phase('link'), 'ready');
  assert.equal(await play.locator('[data-link-score]').textContent(), '0');
  await play.locator('[data-link-difficulty]').selectOption('normal');
  assert.equal(await play.locator('[data-link-cell]').count(), 48);
  assert.equal(await play.locator('[data-link-time]').textContent(), '240');
  await play.locator('[data-link-start]').click();
  await play.clock.runFor(241000);
  assert.equal(await phase('link'), 'lost', 'timeout ends a link round');
  await play.reload(); await ready(play, 'link');
  assert.equal(await play.locator('[data-link-best]').textContent(), '100', 'a partial-round record survives reload');
  await play.close();

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const slug of slugs) {
      await page.goto(gameUrl(slug)); await ready(page, slug);
      if (slug === 'minesweeper') await page.locator('[data-mines-difficulty]').selectOption('hard');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.dataset.theme = value; document.documentElement.style.colorScheme = value; }, theme);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${slug} ${width}px ${theme} must not overflow`);
        if ((width === 390 && theme === 'light') || (width === 320 && theme === 'dark')) await screenshot(page, `arcade-${slug}-${width}-${theme}.png`);
      }
    }
  }
  await context.close();

  const mobile = await createContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await mobile.newPage();
  // Native touch gestures run in real time; deterministic timer checks run above.
  const cdp = await mobile.newCDPSession(touchPage);
  async function dragTouch(selector, from, to) {
    await touchPage.locator(selector).scrollIntoViewIfNeeded();
    const box = await touchPage.locator(selector).boundingBox();
    assert.ok(box);
    const point = ratios => ({ x: box.x + box.width * ratios[0], y: box.y + box.height * ratios[1] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(to)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await touchPage.goto(gameUrl('snake')); await ready(touchPage, 'snake');
  await touchPage.locator('[data-snake-start]').tap();
  await dragTouch('[data-snake-board]', [.5,.65], [.5,.35]);
  await touchPage.waitForFunction(() => Number(document.querySelector('[data-snake-canvas]').getAttribute('aria-label').match(/头在第 (\d+) 行/)[1]) < 11);
  await touchPage.goto(gameUrl('breakout')); await ready(touchPage, 'breakout');
  const touchDock = await touchPage.locator('[data-breakout-canvas]').evaluate(el => el.toDataURL());
  await dragTouch('[data-breakout-canvas]', [.2,.85], [.8,.85]);
  assert.notEqual(await touchPage.locator('[data-breakout-canvas]').evaluate(el => el.toDataURL()), touchDock, 'touch dragging moves the paddle');
  await touchPage.locator('[data-breakout-start]').tap();
  await touchPage.waitForFunction(() => document.querySelector('[data-arcade="breakout"]').dataset.status === 'running', null, { timeout: 5000 });
  await touchPage.locator('[data-breakout-pause]').tap();
  await touchPage.waitForFunction(() => document.querySelector('[data-arcade="breakout"]').dataset.status === 'paused');
  const newBounds = await touchPage.locator('[data-breakout-new]').boundingBox(); assert.ok(newBounds);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x:newBounds.x+2, y:newBounds.y+newBounds.height/2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x:newBounds.x-6, y:newBounds.y+newBounds.height/2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await touchPage.locator('[data-arcade]').getAttribute('data-status'), 'paused', 'sliding outside New Game cancels the touch');
  await touchPage.goto(gameUrl('minesweeper')); await ready(touchPage, 'minesweeper');
  await touchPage.locator('[data-mines-flag]').tap();
  await touchPage.locator('[data-mines-cell="1"]').tap();
  assert.equal(await touchPage.locator('[data-mines-cell="1"]').getAttribute('data-flagged'), 'true');
  await touchPage.goto(gameUrl('link')); await ready(touchPage, 'link');
  const mobileBoard = await touchPage.locator('[data-link-cell]').evaluateAll(cells => ({ rows: 6, cols: 6, tiles: cells.map(cell => Number(cell.dataset.value)) }));
  const mobilePair = findPair(mobileBoard); assert.ok(mobilePair);
  await touchPage.locator(`[data-link-cell="${mobilePair.first}"]`).tap();
  await touchPage.locator(`[data-link-cell="${mobilePair.second}"]`).tap();
  assert.equal(await touchPage.locator('[data-link-score]').textContent(), '100');
  await mobile.close();

  const blocked = await createContext();
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  const blockedPage = await blocked.newPage();
  for (const slug of slugs) {
    await blockedPage.goto(gameUrl(slug)); await ready(blockedPage, slug);
    const storageSelector = slug === 'minesweeper' ? '[data-mines-storage]' : slug === 'link' ? '[data-link-storage]' : `[data-${slug}-save]`;
    assert.match(await blockedPage.locator(storageSelector).textContent(), /无法保存|未允许保存/);
  }
  await blocked.close();

  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const nojsPage = await nojs.newPage();
  for (const slug of slugs) {
    await nojsPage.goto(gameUrl(slug));
    assert.match(await nojsPage.locator('.a-game noscript').textContent(), /启用 JavaScript/);
    assert.equal(await nojsPage.locator('.a-guide').isVisible(), true);
  }
  await nojs.close();
  assert.deepEqual(errors, [], 'no page should report a JavaScript error');
  console.log('四款游戏浏览器验证通过：六款大厅入口、键盘与触屏操作、暂停和重开、记录、320/390px 深浅主题、存储受限与无脚本说明。');
  console.log(`Screenshots: ${screenshots}`);
} finally { await browser.close(); server.close(); }
