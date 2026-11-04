import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (base && !pathname.startsWith(`${base}/`)) { res.writeHead(404).end(); return; }
  const file = path.resolve(dist, pathname.slice(base.length).replace(/^\/+/, ''), pathname.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(`${dist}${path.sep}`)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
let executable = process.env.BROWSER_PATH;
if (!executable) {
  for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
    try { await access(candidate); executable = candidate; break; } catch { /* Try next browser. */ }
  }
}
assert.ok(executable, '请设置 BROWSER_PATH，指向 Chrome 或 Chromium。');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: executable, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function openSearch() {
    const menu = page.locator('[data-header-menu-toggle]');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    await page.locator('[data-search-open]').click();
  }
  async function search(query) {
    await page.locator('#search-input').fill(query);
    await page.waitForFunction(() => /^(找到|还没找到)/.test(document.querySelector('[data-search-status]').textContent));
  }
  const entries = [
    ['贪吃蛇', '星际贪吃蛇', '/games/snake/', '游戏'],
    ['扫雷', '星域扫雷', '/games/minesweeper/', '游戏'],
    ['打砖块', '星际打砖块', '/games/breakout/', '游戏'],
    ['连连看', '星图连连看', '/games/link/', '游戏'],
    ['2048', '2048 星球合成', '/games/2048/', '游戏'],
    ['猜大小', '三骰猜大小', '/games/dice/', '游戏'],
    ['角色旅程', '人生格子 · 角色旅程', '/tools/life/', '功能'],
    ['时光回放', '人生格子 · 时光回放', '/tools/life-replay/', '功能'],
    ['Reconnecting', 'Codex 反复重连 Reconnecting 的排查与配置参考', '/posts/codex-reconnecting-troubleshooting/', '文章'],
    ['好人缘', '好人缘，是这样慢慢养成的', '/posts/renyuan-20261102/', '贴图'],
  ];
  for (const [query, title, route, type] of entries) {
    await page.goto(`${origin}${base}/about/`);
    await openSearch();
    await search(query);
    const result = page.locator(`.u-search-result[href="${base}${route}"]`);
    assert.equal(await result.count(), 1, `搜索“${query}”应找到 ${route}`);
    assert.equal(await result.locator('strong').textContent(), title);
    assert.equal(await result.locator('.u-search-result-type').textContent(), type);
    if (type === '功能') { await result.focus(); await page.keyboard.press('Enter'); }
    else await result.click();
    await page.waitForURL(`${origin}${base}${route}`);
    assert.equal(await page.locator('h1').count(), 1, '搜索结果应跳到可用的详情页');
  }
  await page.goto(`${origin}${base}/about/`);
  await openSearch();
  await search('人生格子');
  assert.equal(await page.locator(`.u-search-result[href^="${base}/tools/"]`).count(), 2);
  await mkdir('.tools/screenshots', { recursive: true });
  await page.locator('#site-search').screenshot({ path: '.tools/screenshots/search-features-desktop.png' });

  // Clear between queries so a previous completed request cannot satisfy the wait.
  await page.locator('#search-input').fill('');
  assert.equal(await page.locator('.u-search-result').count(), 0);
  await search('"DRAFT_ONLY_SENTINEL_7bf1"');
  assert.equal(await page.locator('.u-search-result').count(), 0, '草稿不得出现在搜索结果里');
  await page.locator('#search-input').fill('');
  await search('no-results-7bf1-sentinel');
  assert.equal(await page.locator('.u-search-result').count(), 0);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`${origin}${base}/about/`);
  await openSearch();
  await search('2048');
  const mobileResult = page.locator(`.u-search-result[href="${base}/games/2048/"]`);
  assert.equal(await mobileResult.locator('.u-search-result-type').textContent(), '游戏');
  const fits = await page.locator('#site-search').evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth);
  assert.ok(fits, '320px 屏幕下搜索结果不应横向溢出');
  await page.locator('#site-search').screenshot({ path: '.tools/screenshots/search-game-mobile.png' });
  await mobileResult.click();
  await page.waitForURL(`${origin}${base}/games/2048/`);
  assert.deepEqual(errors, [], '搜索与跳转不应产生页面异常');
  console.log('搜索验证通过：6 款游戏、2 个功能、文章与贴图；类型标识、点击/键盘跳转、空结果、草稿排除及 320px 手机布局。');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
