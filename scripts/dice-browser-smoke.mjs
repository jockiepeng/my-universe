import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';
import { createGame, playRound, STORAGE_KEY } from '../src/lib/dice-game.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const screenshots = path.resolve('.tools/screenshots');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base && !pathname.startsWith(base + '/')) throw new Error('base path');
    const file = path.resolve(dist, pathname.slice(base.length).replace(/^\/+/, ''), pathname.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(dist + path.sep)) throw new Error('path');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + base + '/games/dice/';
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Try next browser. */ }
}
if (!executable) { server.close(); throw new Error('Set BROWSER_PATH to Chrome.'); }
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ executablePath: executable, headless: true });
const errors = [];
async function ready(page) {
  await page.waitForSelector('[data-dice-game][data-ready="true"]');
}
async function setDice(page, dice) {
  await page.evaluate(values => { window.__diceBytes = values.map(value => value - 1); }, dice);
}
async function play(page, bets, dice, rounds) {
  await setDice(page, dice);
  for (const [spot, amount] of Object.entries(bets)) {
    await page.locator('[data-chip-amount]').fill(String(amount));
    await page.locator(`[data-spot="${spot}"]`).click();
  }
  await page.locator('[data-roll]').click();
  await page.waitForFunction(count => document.querySelector('[data-stat-rounds]').textContent === String(count) && !document.querySelector('[data-bet-controls]').disabled, rounds);
}
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1100 }, reducedMotion: 'reduce', colorScheme: 'light', ...options });
  await ctx.addInitScript(() => {
    const original = Crypto.prototype.getRandomValues;
    Crypto.prototype.getRandomValues = function(array) {
      if (window.__diceBytes?.length) { array[0] = window.__diceBytes.shift(); return array; }
      return original.call(this, array);
    };
  });
  ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return ctx;
}

try {
  const ctx = await context();
  const page = await ctx.newPage();
  await page.goto(origin + base + '/');
  await page.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
  if (await page.locator('html').getAttribute('data-entry') === 'open') await page.locator('[data-entry-skip]').click();
  await page.locator('.u-game-link').click();
  assert.equal(new URL(page.url()).pathname, base + '/games/');
  await page.screenshot({ path: path.join(screenshots, 'games-lobby-desktop.png'), fullPage: true });
  await page.locator('.g-game-card').click();
  await ready(page);
  assert.equal(await page.locator('[data-balance]').textContent(), '1,000');
  assert.equal(await page.locator('.u-nav [aria-current="page"]').textContent(), '游戏');
  await play(page, { small: 50 }, [1, 2, 3], 1);
  assert.equal(await page.locator('[data-balance]').textContent(), '1,050');
  await play(page, { big: 50 }, [1, 2, 3], 2);
  assert.equal(await page.locator('[data-balance]').textContent(), '1,000');
  await play(page, { small: 50, 6: 10 }, [2, 2, 2], 3);
  assert.equal(await page.locator('[data-balance]').textContent(), '1,090');
  assert.match(await page.locator('.g-history-item').first().textContent(), /6 点 · 小 · 豹子/);
  await play(page, { 4: 10 }, [1, 1, 2], 4);
  assert.equal(await page.locator('[data-balance]').textContent(), '1,590');
  assert.equal(await page.locator('[data-frequent]').textContent(), '6 点');
  await page.reload(); await ready(page);
  assert.equal(await page.locator('[data-balance]').textContent(), '1,590');
  assert.equal(await page.locator('.g-history-item').count(), 4);
  await page.locator('[data-chip-amount]').fill('0.5');
  await page.locator('[data-spot="small"]').click();
  assert.match(await page.locator('[data-result]').textContent(), /整数/);
  assert.equal(await page.locator('[data-stake]').textContent(), '0');
  await page.locator('[data-chip-amount]').fill('2000');
  await page.locator('[data-spot="small"]').click();
  assert.match(await page.locator('[data-result]').textContent(), /不足/);
  await page.locator('[data-chip="50"]').click();
  await page.locator('[data-spot="big"]').click();
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('[data-stake]').textContent(), '0');

  const other = await ctx.newPage();
  await other.goto(url); await ready(other);
  await other.locator('[data-spot="big"]').click();
  await play(page, { small: 10 }, [1, 2, 3], 5);
  await other.waitForFunction(() => document.querySelector('[data-stat-rounds]').textContent === '5');
  assert.equal(await other.locator('[data-stake]').textContent(), '0');
  assert.equal(await other.locator('[data-balance]').textContent(), '1,600');
  await other.close();

  // A settled animated round survives reload before the animation has finished.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('[data-chip-amount]').fill('10');
  await page.locator('[data-spot="small"]').click();
  await setDice(page, [1, 2, 3]);
  await page.locator('[data-roll]').click();
  await page.waitForSelector('[data-rolling]');
  assert.equal(await page.locator('[data-roll]').isDisabled(), true);
  await page.reload(); await ready(page);
  assert.equal(await page.locator('[data-stat-rounds]').textContent(), '6');
  assert.equal(await page.locator('[data-balance]').textContent(), '1,610');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshots, 'dice-desktop.png'), fullPage: true });

  // Reset cancellation, exhausted balance, and a new configurable bankroll.
  await page.locator('[data-reset-open]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-stat-rounds]').textContent(), '6');
  await play(page, { big: 1610 }, [1, 2, 3], 7);
  assert.equal(await page.locator('[data-balance]').textContent(), '0');
  assert.match(await page.locator('[data-result]').textContent(), /金币用完/);
  await page.locator('[data-reset-open]').click();
  assert.equal(await page.locator('[data-initial-coins]').evaluate(el => document.activeElement === el), true);
  await page.locator('[data-initial-coins]').fill('777');
  await page.locator('[data-reset-form] button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-reset-dialog]').open);
  assert.equal(await page.locator('[data-balance]').textContent(), '777');
  assert.equal(await page.locator('.g-history-item').count(), 0);
  assert.equal(await page.locator('[data-frequent]').textContent(), '还没有记录');
  await page.reload(); await ready(page);
  assert.equal(await page.locator('[data-balance]').textContent(), '777');
  assert.equal(await page.locator('[data-stat-rounds]').textContent(), '0');

  let many = createGame();
  for (let i = 0; i < 21; i++) many = playRound(many, { small: 10 }, i % 2 ? [1, 2, 4] : [1, 2, 3]);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, data), { key: STORAGE_KEY, data: JSON.stringify(many) });
  await page.reload(); await ready(page);
  assert.equal(await page.locator('.g-history-item').count(), 20);
  await page.locator('[data-load-more]').click();
  assert.equal(await page.locator('.g-history-item').count(), 21);
  assert.equal(await page.locator('[data-stat-rounds]').textContent(), '21');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; document.documentElement.style.colorScheme = value; }, theme);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => Math.ceil(document.querySelector('.u-header-shell').getBoundingClientRect().height) === parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u-header-height')));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px ${theme} overflow`);
      assert.equal(await page.locator('.u-nav a').evaluateAll(links => links.every(link => { const range = document.createRange(); range.selectNodeContents(link); return range.getClientRects().length === 1; })), true, `${width}px navigation must remain on one line`);
      assert.equal(await page.locator('.g-size-spot').evaluateAll(buttons => buttons.every(button => { const spot = button.getBoundingClientRect(); const amount = button.querySelector('strong').getBoundingClientRect(); return amount.x >= spot.x && amount.right <= spot.right && amount.y >= spot.y && amount.bottom <= spot.bottom; })), true, `${width}px bet amounts must stay inside their button`);
      await page.screenshot({ path: path.join(screenshots, `dice-mobile-${width}-${theme}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1360, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshots, 'dice-desktop-dark.png'), fullPage: true });

  // Hold the shared lock while a reset waits, then publish a newer round.
  const lockHolder = await ctx.newPage();
  await lockHolder.goto(url); await ready(lockHolder);
  await lockHolder.evaluate(key => new Promise(acquired => {
    navigator.locks.request(key, () => new Promise(release => { window.__releaseDiceLock = release; acquired(); }));
  }), STORAGE_KEY);
  const before = await lockHolder.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const newer = playRound(before, { small: 10 }, [1, 2, 3]);
  await page.locator('[data-reset-open]').click();
  await page.locator('[data-initial-coins]').fill('555');
  await page.locator('[data-reset-form] button[type="submit"]').click();
  await lockHolder.evaluate(({ key, raw }) => { localStorage.setItem(key, raw); window.__releaseDiceLock(); }, { key: STORAGE_KEY, raw: JSON.stringify(newer) });
  await page.waitForFunction(() => document.querySelector('[data-reset-error]').textContent.includes('已同步'));
  assert.equal(await page.locator('[data-reset-dialog]').evaluate(el => el.open), true);
  assert.equal(await page.locator('[data-stat-rounds]').textContent(), '22');
  assert.equal(await page.locator('[data-balance]').textContent(), '1,220');
  await page.locator('[data-reset-form] button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-reset-dialog]').open);
  assert.equal(await page.locator('[data-balance]').textContent(), '555');
  await lockHolder.close();

  await page.locator('[data-chip-amount]').fill('10');
  await page.locator('[data-spot="small"]').click();
  await setDice(page, [1, 2, 3]);
  await page.locator('[data-roll]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-stat-rounds]').textContent === '1');
  assert.equal(await page.locator('[data-spot="small"]').evaluate(el => document.activeElement === el), true, 'keyboard play should return focus to the chosen betting spot');

  await page.evaluate(key => localStorage.setItem(key, '{bad json'), STORAGE_KEY);
  await page.reload(); await ready(page);
  assert.equal(await page.locator('[data-balance]').textContent(), '1,000');
  assert.match(await page.locator('[data-save-note]').textContent(), /无法读取/);
  await ctx.close();

  const blocked = await context();
  await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'QuotaExceededError'); }; });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(url); await ready(blockedPage);
  await play(blockedPage, { small: 50 }, [1, 2, 3], 1);
  assert.equal(await blockedPage.locator('[data-balance]').textContent(), '1,050');
  assert.match(await blockedPage.locator('[data-save-note]').textContent(), /无法保存/);
  await play(blockedPage, { small: 50 }, [1, 2, 3], 2);
  assert.equal(await blockedPage.locator('[data-balance]').textContent(), '1,100');
  await blocked.close();

  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const nojsPage = await nojs.newPage();
  await nojsPage.goto(url);
  assert.match(await nojsPage.locator('[data-dice-game] noscript').textContent(), /启用 JavaScript/);
  assert.equal(await nojsPage.locator('[data-spot="small"]').isDisabled(), true);
  await nojs.close();
  assert.deepEqual(errors, []);
  console.log('游戏浏览器验证通过：首页入口、大厅、大小输赢、豹子与总点数赔率、多位置下注、输入校验、清空、刷新持久化、跨页同步、动画中刷新、余额耗尽、自定义金币重开、完整历史、320/390px 深浅主题、坏存档、存储失败及无脚本提示。');
  console.log(`截图：${screenshots}`);
} finally { await browser.close(); server.close(); }
