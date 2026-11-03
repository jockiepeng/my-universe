import { chromium } from 'playwright-core';
import { access, readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const origin = process.env.SITE_URL || 'https://jockiepeng.github.io';
const dist = path.resolve('dist');
const screenshotDir = path.resolve('.tools/screenshots');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm' };
async function localResponse(url) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  if (base && !pathname.startsWith(`${base}/`)) return { status: 404, body: '' };
  const file = path.resolve(dist, pathname.slice(base.length).replace(/^\/+/, ''), pathname.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(`${dist}${path.sep}`)) return { status: 403, body: '' };
  try { return { status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body: await readFile(file) }; }
  catch { return { status: 404, body: '' }; }
}
const server = createServer(async (req, res) => {
  const response = await localResponse(`http://127.0.0.1${req.url}`);
  res.writeHead(response.status, { 'Content-Type': response.contentType || 'text/plain' }).end(response.body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const checks = [];
try {
  let executable = process.env.BROWSER_PATH;
  if (!executable) for (const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
    try { await access(candidate); executable = candidate; break; } catch { /* next */ }
  }
  assert.ok(executable, 'Set BROWSER_PATH to Chrome or Chromium');
  browser = await chromium.launch({ executablePath: executable, headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1360, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  let geoMode = 'success';
  let viewsMode = 'success';
  let releaseViews;
  const providerResponse = await fetch('https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js', { signal: AbortSignal.timeout(15000) });
  assert.ok(providerResponse.ok);
  const providerSource = await providerResponse.text();
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.hostname === '127.0.0.1') return route.fulfill(await localResponse(url.href));
    requests.push(url.href);
    if (url.hostname === 'ipapi.co') {
      if (geoMode === 'timeout') return;
      if (geoMode === 'network') return route.abort();
      const data = geoMode === 'success' ? { country_code: 'CN', region: '广东省', city: '深圳市' } : { error: true, reason: 'RateLimited' };
      return route.fulfill({ status: geoMode === 'limited' ? 429 : 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) });
    }
    if (url.hostname === 'busuanzi.ibruce.info') {
      if (url.pathname.endsWith('.js')) {
        if (viewsMode === 'network') return route.abort();
        return route.fulfill({ contentType: 'text/javascript', body: providerSource });
      }
      if (viewsMode === 'late') await new Promise(resolve => { releaseViews = resolve; });
      const callback = url.searchParams.get('jsonpCallback');
      return route.fulfill({ contentType: 'text/javascript', body: `${callback}(${JSON.stringify({ page_pv: 42, site_pv: viewsMode === 'zero' ? 0 : 1234, site_uv: 10 })});` });
    }
    return route.abort();
  });
  const home = `${origin}${base}/`;
  const location = page.locator('[data-visitor-location]');
  const views = page.locator('[data-site-views]');
  async function enter() {
    await page.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
    if (await page.locator('html').getAttribute('data-entry') === 'open') await page.locator('[data-entry-skip]').click();
  }
  await page.goto(`http://127.0.0.1:${server.address().port}${base}/`);
  await enter();
  assert.equal(await views.count(), 1, '首页应显示累计浏览量');
  assert.match(await location.innerText(), /本地预览/);
  assert.equal(requests.length, 0, '本地不应请求任何第三方服务');
  checks.push('本地预览有占位且不请求定位或真实计数');

  await page.goto(home);
  await enter();
  await location.filter({ hasText: '中国 · 广东省 · 深圳市' }).waitFor();
  await page.waitForFunction(() => document.querySelector('#busuanzi_value_site_pv')?.textContent === '1234');
  assert.match(await views.innerText(), /累计浏览量.*1,?234.*次/s);
  assert.equal(await page.getByLabel('IP 归属地', { exact: true }).locator('svg').count(), 1);
  assert.doesNotMatch(await page.locator('.u-visitor-info').innerText(), /你来自/);
  assert.equal(await page.locator('[data-site-views] [data-views-fallback]').isVisible(), false);
  assert.equal(requests.filter(url => url.includes('/busuanzi?')).length, 1, '每页只计数一次');
  assert.equal(await page.locator('script[src*="busuanzi.pure"]').count(), 1);
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'visitor-info-desktop.png') });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    assert.equal(await location.isVisible(), true, '手机应显示归属地');
    assert.equal(await views.isVisible(), true, '手机应显示累计浏览量');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(screenshotDir, `visitor-info-mobile-${width}.png`) });
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: path.join(screenshotDir, 'visitor-info-dark.png') });
  checks.push('正式首页定位与全站 PV、桌面/手机/深色显示、每页单次请求');

  requests.length = 0;
  for (const route of ['posts/ai-tools-setup/', 'about/', 'games/snake/']) {
    const counted = page.waitForResponse(response => response.url().includes('/busuanzi?'));
    await page.goto(`${home}${route}`);
    await counted;
    if (route.startsWith('posts/')) {
      await page.waitForFunction(() => document.querySelector('#busuanzi_value_page_pv')?.textContent === '42');
      assert.equal(await page.locator('[data-page-views] [data-views-fallback]').isVisible(), false);
    }
    assert.equal(await views.count(), 0, '只在首页展示全站统计');
    assert.equal(await location.count(), 0, '非首页不显示或查询归属地');
    assert.equal(await page.locator('script[src*="busuanzi.pure"]').count(), 1);
  }
  assert.equal(requests.filter(url => url.includes('/busuanzi?')).length, 3);
  assert.equal(requests.filter(url => url.includes('ipapi.co')).length, 0);
  checks.push('文章/关于/游戏均单次计数，文章 PV 保持正常且非首页不查定位');

  await page.clock.install();
  for (const mode of ['limited', 'invalid', 'network', 'timeout']) {
    geoMode = mode;
    await page.goto(home, { waitUntil: 'domcontentloaded' });
    if (mode === 'timeout') {
      await page.waitForFunction(() => !!document.querySelector('script[src*="busuanzi.pure"]'));
      await page.clock.fastForward(9000);
    }
    await location.filter({ hasText: '暂不可用' }).waitFor();
  }
  checks.push('定位限流/业务错误/网络失败/超时均明确降级');
  geoMode = 'success';
  viewsMode = 'late';
  const lateRequest = page.waitForRequest(request => request.url().includes('/busuanzi?'));
  await page.goto(home, { waitUntil: 'domcontentloaded' });
  await lateRequest;
  await page.clock.fastForward(13000);
  assert.match(await views.getAttribute('title'), /暂不可用/);
  releaseViews();
  await page.waitForFunction(() => document.querySelector('#busuanzi_value_site_pv')?.textContent === '1234');
  assert.equal(await page.locator('[data-site-views] [data-views-fallback]').isVisible(), false);
  assert.doesNotMatch(await views.getAttribute('title'), /暂不可用/);
  viewsMode = 'zero';
  await page.goto(home);
  await page.waitForFunction(() => document.querySelector('#busuanzi_value_site_pv')?.textContent === '0');
  assert.equal(await page.locator('[data-site-views] [data-views-fallback]').isVisible(), false);
  viewsMode = 'network';
  await page.goto(home);
  await page.waitForFunction(() => document.querySelector('[data-site-views]')?.title.includes('暂不可用'));
  assert.equal(await page.locator('[data-site-views] [data-views-fallback]').isVisible(), true);
  checks.push('计数迟到成功恢复、零值显示、脚本失败保持占位');
  assert.deepEqual(errors, []);
  await context.close();

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  await noJs.route(`${origin}/**`, async route => route.fulfill(await localResponse(route.request().url())));
  const staticPage = await noJs.newPage();
  await staticPage.goto(home);
  assert.match(await staticPage.locator('[data-visitor-location]').innerText(), /需要 JavaScript/);
  assert.match(await staticPage.locator('[data-site-views]').innerText(), /—/);
  await noJs.close();
  checks.push('无脚本显示真实占位和提示');
  console.log(JSON.stringify({ status: 'pass', checks, screenshotDir }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
