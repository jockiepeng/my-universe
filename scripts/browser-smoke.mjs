import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const screenshots = path.resolve('.tools/screenshots');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.xml': 'application/xml' };
async function localResponse(url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  if (base && !pathname.startsWith(`${base}/`)) return { status: 404, body: 'Not found', contentType: 'text/plain' };
  const relative = pathname.slice(base.length).replace(/^\/+/, '');
  const file = path.resolve(dist, relative, pathname.endsWith('/') ? 'index.html' : '');
  if (file !== dist && !file.startsWith(`${dist}${path.sep}`)) return { status: 403, body: 'Forbidden', contentType: 'text/plain' };
  try { return { status: 200, body: await readFile(file), contentType: types[path.extname(file)] || 'application/octet-stream' }; }
  catch { return { status: 404, body: await readFile(path.join(dist, '404.html')), contentType: 'text/html; charset=utf-8' }; }
}
const server = createServer(async (req, res) => {
  const response = await localResponse(`http://127.0.0.1${req.url}`);
  res.writeHead(response.status, { 'Content-Type': response.contentType }); res.end(response.body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${base}/`;
let executable = process.env.BROWSER_PATH;
if (!executable) {
  for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
    try { await access(candidate); executable = candidate; break; } catch { /* Try next installed browser. */ }
  }
}
if (!executable) { server.close(); throw new Error('请设置 BROWSER_PATH，指向已安装的 Chrome 或 Chromium。'); }
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ executablePath: executable, headless: true });
const checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.getByRole('button', { name: '切换背景，当前为深空' }).click();
  await page.locator('[data-scene-option="beach"]').click();
  assert.equal(await page.locator('html').getAttribute('data-scene'), 'beach');
  await page.locator('[data-theme-toggle]').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: path.join(screenshots, 'home-beach-dark.png'), fullPage: true });
  await page.getByRole('link', { name: '记录不必等到想明白', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('data-scene'), 'beach');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.locator('script[src*="busuanzi"]').count(), 0);
  assert.match(await page.locator('[data-page-views]').innerText(), /—/);
  checks.push('背景与主题在文章页面保持，本地不请求真实计数');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-scene'), 'beach');
  checks.push('刷新恢复背景');
  await page.getByRole('button', { name: '搜索文章', exact: true }).click();
  await page.locator('#search-input').fill('工具');
  await page.locator('.u-search-result').first().waitFor();
  assert.match(await page.locator('.u-search-result').first().getAttribute('href'), new RegExp(`${base}/posts/`));
  assert.match(await page.locator('.u-search-result').first().innerText(), /工具/);
  await page.locator('#search-input').fill('DRAFT_ONLY_SENTINEL_7bf1');
  await page.getByText('还没找到相关记录，试试换个关键词。', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  checks.push('中文全文搜索与草稿排除');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}posts/everyday-tools/`);
  assert.equal(await page.locator('.u-toc').getAttribute('open'), null);
  await page.screenshot({ path: path.join(screenshots, 'article-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  await page.locator('[data-scene-toggle]').click();
  const bounds = await page.locator('#scene-picker').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.keyboard.press('Escape');
  checks.push('320px 手机面板与正文无页面横向溢出');
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.goto(url);
  await page.locator('[data-scene-toggle]').click();
  await page.locator('[data-scene-option="space"]').click();
  await page.screenshot({ path: path.join(screenshots, 'home-deep-space.png'), fullPage: true });
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const readable = await noJs.newPage(); await readable.goto(`${url}posts/writing-before-knowing/`);
  assert.match(await readable.locator('.u-article-body').innerText(), /先留下一个念头/);
  assert.equal(await readable.locator('[data-enhanced]').first().isVisible(), false);
  await noJs.close(); checks.push('关闭 JavaScript 仍可阅读');
  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const calm = await reduced.newPage(); await calm.goto(url);
  assert.equal(await calm.locator('html').getAttribute('data-motion'), 'off');
  await reduced.close(); checks.push('减少动态效果设置生效');
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  const temporary = await blocked.newPage(); await temporary.goto(url);
  await temporary.locator('[data-scene-toggle]').click(); await temporary.locator('[data-scene-option="beach"]').click();
  assert.equal(await temporary.locator('html').getAttribute('data-scene'), 'beach');
  await blocked.close(); checks.push('存储被禁用时背景切换仍可用');
  assert.deepEqual(errors, []); checks.push('页面无 JavaScript 运行错误');

  // Use local responses under the real origin to verify actual browser referrer policy.
  const productionOrigin = process.env.SITE_URL || 'https://jockiepeng.github.io';
  const production = await browser.newContext();
  const referrers = [];
  let releaseLate;
  const providerResponse = await fetch('https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js', { signal: AbortSignal.timeout(15000) });
  assert.ok(providerResponse.ok, '无法读取不蒜子公开脚本');
  const providerSource = await providerResponse.text();
  await production.route(`${productionOrigin}/**`, async route => route.fulfill(await localResponse(route.request().url())));
  await production.route('https://busuanzi.ibruce.info/**', async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('.js')) {
      await route.fulfill({ contentType: 'text/javascript', body: providerSource });
      return;
    }
    referrers.push(route.request().headers().referer);
    if (referrers.length === 2) await new Promise(resolve => { releaseLate = resolve; });
    const callback = requestUrl.searchParams.get('jsonpCallback');
    await route.fulfill({ contentType: 'text/javascript', body: `${callback}({page_pv:42,site_pv:0,site_uv:0});` });
  });
  const live = await production.newPage();
  const articleUrl = `${productionOrigin}${base}/posts/writing-before-knowing/`;
  await live.goto(articleUrl);
  await live.waitForFunction(() => document.querySelector('#busuanzi_value_page_pv')?.textContent === '42');
  assert.equal(referrers[0], articleUrl, '计数请求应携带文章路径，避免所有文章合并到域名计数');
  assert.match(await live.locator('[data-page-views]').innerText(), /42/);
  await live.clock.install();
  const lateRequest = live.waitForRequest(request => request.url().includes('/busuanzi?'));
  await live.goto(`${productionOrigin}${base}/posts/everyday-tools/`, { waitUntil: 'domcontentloaded' });
  await lateRequest;
  await live.clock.fastForward(13000);
  assert.match(await live.locator('[data-page-views]').getAttribute('title'), /暂不可用/);
  releaseLate();
  await live.waitForFunction(() => document.querySelector('#busuanzi_value_page_pv')?.textContent === '42');
  assert.equal(await live.locator('[data-views-fallback]').isVisible(), false, '迟到成功也必须隐藏占位，避免显示 —42');
  assert.doesNotMatch(await live.locator('[data-page-views]').getAttribute('title'), /暂不可用/);
  await production.close(); checks.push('正式文章计数请求保留独立文章路径，显示服务返回数字');
  checks.push('统计超时后的迟到成功不会与占位混合');
  console.log(JSON.stringify({ status: 'pass', checks, screenshots }, null, 2));
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
