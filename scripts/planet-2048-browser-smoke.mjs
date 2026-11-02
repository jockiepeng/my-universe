import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';
import { STORAGE_KEY } from '../src/lib/planet-2048.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
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
const url = `${origin}${base}/games/2048/`;
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Try next browser. */ }
}
const browser = await chromium.launch({ executablePath: executable, headless: true });
const errors = [];
const seed = (board, extra = {}) => ({ version: 1, board, score: 0, best: 0, moves: 0, continued: false, ...extra });
const pair = [2, 2, ...Array(14).fill(0)];
async function ready(page) { await page.waitForSelector('[data-planet-game][data-ready="true"]'); }
async function load(page, state) {
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state });
  await page.reload(); await ready(page);
}
async function cells(page) { return page.locator('[data-planet-cell]').evaluateAll(els => els.map(el => Number(el.dataset.value))); }
async function moved(page) { await page.waitForFunction(() => document.querySelector('[data-planet-moves]').textContent === '1' && document.querySelector('[data-planet-game]').dataset.busy !== 'true'); }
try {
  await mkdir('.tools/screenshots', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 1100 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  assert.equal((await page.goto(url)).status(), 200, '2048 游戏页应存在');
  await ready(page);
  assert.equal((await cells(page)).filter(Boolean).length, 2);
  await page.goto(`${origin}${base}/games/`);
  await page.locator(`a[href="${base}/games/2048/"]`).click(); await ready(page);
  await load(page, seed(pair));
  await page.locator('[data-planet-board]').focus();
  await page.keyboard.press('ArrowLeft'); await moved(page);
  assert.equal((await cells(page))[0], 4);
  assert.equal(await page.locator('[data-planet-score]').textContent(), '4');
  assert.equal(await page.locator('[data-planet-best]').textContent(), '4');
  const saved = await cells(page);
  await page.reload(); await ready(page);
  assert.deepEqual(await cells(page), saved);
  assert.equal(await page.locator('[data-planet-moves]').textContent(), '1');
  await page.locator('[data-planet-new]').click();
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await cells(page), saved, '对话框内按方向键不能移动棋盘');
  await page.locator('[data-planet-cancel]').click();
  assert.deepEqual(await cells(page), saved);
  await page.locator('[data-planet-new]').focus(); await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await cells(page), saved, '操作按钮上的方向键不能移动棋盘');
  await page.locator('[data-planet-new]').click(); await page.locator('[data-planet-confirm]').click();
  assert.equal(await page.locator('[data-planet-moves]').textContent(), '0');
  assert.equal(await page.locator('[data-planet-best]').textContent(), '4');

  await load(page, seed([1024, 1024, ...Array(14).fill(0)]));
  await page.locator('[data-planet-direction="left"]').click(); await moved(page);
  assert.equal(await page.locator('[data-planet-game]').getAttribute('data-status'), 'won');
  assert.equal(await page.locator('[data-planet-continue]').isVisible(), true);
  await page.reload(); await ready(page);
  assert.equal(await page.locator('[data-planet-continue]').isVisible(), true);
  await page.locator('[data-planet-continue]').click();
  await page.reload(); await ready(page);
  assert.equal(await page.locator('[data-planet-continue]').isVisible(), false);
  const stuck = [2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  await load(page, seed(stuck));
  assert.equal(await page.locator('[data-planet-game]').getAttribute('data-status'), 'over');
  assert.match(await page.locator('[data-planet-message]').textContent(), /没有可移动/);
  await load(page, seed([2,2,8,16,4,8,16,32,8,16,32,64,16,32,64,128]));
  assert.equal(await page.locator('[data-planet-game]').getAttribute('data-status'), 'playing');
  await page.locator('[data-planet-direction="left"]').click(); await moved(page);

  await load(page, seed([2,4,8,16,32,64,128,256,512,1024,0,0,0,0,0,0], { score: 1600, best: 3200, moves: 120 }));
  await page.screenshot({ path: '.tools/screenshots/planet-2048-desktop.png', fullPage: true });
  await page.locator('[data-theme-toggle]').click();
  await page.screenshot({ path: '.tools/screenshots/planet-2048-dark.png', fullPage: true });
  await page.evaluate(key => localStorage.setItem(key, '{"board":[]}'), STORAGE_KEY);
  await page.reload(); await ready(page);
  assert.equal((await cells(page)).filter(Boolean).length, 2, '损坏存档重新开局');
  assert.match(await page.locator('[data-planet-save]').textContent(), /旧进度无法读取/);
  await context.close();

  const animatedContext = await browser.newContext({ reducedMotion: 'no-preference' });
  const animated = await animatedContext.newPage();
  animated.on('pageerror', error => errors.push(error.message));
  await animated.goto(url); await ready(animated); await load(animated, seed(pair));
  const animation = await animated.evaluate(() => {
    const board = document.querySelector('[data-planet-board]'); board.focus();
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowDown']) board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    return { busy: document.querySelector('[data-planet-game]').dataset.busy, count: board.getAnimations({ subtree: true }).length };
  });
  assert.equal(animation.busy, 'true');
  assert.ok(animation.count > 0, '启用动态时真实播放移动动画');
  await moved(animated);
  assert.equal((await cells(animated))[0], 4);
  assert.equal(await animated.locator('[data-planet-moves]').textContent(), '1', '动画期间快速连按不会重入并损坏棋盘');
  await animatedContext.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(url); await ready(phone); await load(phone, seed(pair));
  await phone.locator('[data-planet-board]').scrollIntoViewIfNeeded();
  const box = await phone.locator('[data-planet-board]').boundingBox();
  const session = await mobile.newCDPSession(phone);
  const x = box.x + box.width * .8, y = box.y + box.height * .55;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 130, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await moved(phone);
  assert.equal((await cells(phone))[0], 4, '真实触屏滑动能合并');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 4, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await phone.locator('[data-planet-moves]').textContent(), '1', '轻触不触发移动');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 100, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await phone.locator('[data-planet-moves]').textContent(), '1', '被系统取消的手势不触发移动');
  for (const width of [390, 320]) {
    await phone.setViewportSize({ width, height: 844 });
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px 无横向溢出`);
    await phone.screenshot({ path: `.tools/screenshots/planet-2048-mobile-${width}.png`, fullPage: true });
  }
  await mobile.close();

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  const temporary = await blocked.newPage();
  temporary.on('pageerror', error => errors.push(error.message));
  await temporary.goto(url); await ready(temporary);
  assert.match(await temporary.locator('[data-planet-save]').textContent(), /无法保存/);
  await temporary.locator('[data-planet-board]').focus();
  for (const direction of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) await temporary.keyboard.press(direction);
  await temporary.waitForFunction(() => Number(document.querySelector('[data-planet-moves]').textContent) > 0);
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log('PASS: 大厅入口、键盘、动画与快速连按、真实触屏与取消手势、存档恢复与损坏、重开确认、胜利继续、结束判定、深浅色、320px 和禁用存储');
} finally { await browser.close(); server.close(); }
