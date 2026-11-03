import { chromium } from 'playwright-core';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const root = path.resolve('dist');
const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const origin = 'http://127.0.0.1:4321';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.wasm': 'application/wasm' };
let executablePath = process.env.BROWSER_PATH;
if (!executablePath) for (const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  try { await access(candidate); executablePath = candidate; break; } catch { /* next */ }
}
assert.ok(executablePath, 'Set BROWSER_PATH to Chrome or Chromium');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1360, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || !url.pathname.startsWith(`${base}/`)) return route.abort();
    const file = path.resolve(root, decodeURIComponent(url.pathname.slice(base.length + 1)), url.pathname.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(`${root}${path.sep}`)) return route.abort();
    try { return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: await readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: '' }); }
  });
  await page.goto(`${origin}${base}/#recent-title`);
  await page.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
  const posts = page.locator('[data-post-list] > article');
  const created = await posts.locator('[data-post-created]').evaluateAll(elements => elements.map(el => Date.parse(el.getAttribute('datetime'))));
  assert.ok(created.length > 0);
  assert.deepEqual(created, [...created].sort((a, b) => b - a), '首页按创建时间倒序');
  for (const post of await posts.all()) {
    const first = post.locator('[data-post-created]');
    const edited = post.locator('[data-post-updated]');
    assert.match(await first.innerText(), /\d{2}:\d{2}:\d{2}/);
    assert.match(await edited.innerText(), /\d{2}:\d{2}:\d{2}/);
    assert.ok(Date.parse(await edited.getAttribute('datetime')) >= Date.parse(await first.getAttribute('datetime')));
  }
  const photo = posts.filter({ has: page.locator(`a[href="${base}/posts/billiards-teaching-20261103/"]`) });
  assert.equal(await photo.getAttribute('data-category'), '生活/运动');
  await page.locator('.u-topic-sidebar [data-topic-filter="生活"]').click();
  await page.locator('[data-subcategory-group="生活"] [data-topic-filter="生活/运动"]').click();
  assert.equal(await photo.isVisible(), true);
  assert.equal(await page.locator('[data-post-list] > article:visible').count(), 1);
  await page.locator('[data-filter="photo"]').click();
  assert.equal(await photo.isVisible(), true);
  await photo.locator('h3 a').click();
  assert.equal((await page.locator('.u-article-head .u-category').innerText()).replace(/\s+/g, ''), '生活/运动');
  assert.match(await page.locator('.u-article-head [data-post-created]').innerText(), /00:00:00/);
  assert.match(await page.locator('.u-article-head [data-post-created]').getAttribute('title'), /仅精确到日期/);
  await mkdir('.tools/screenshots', { recursive: true });
  await page.screenshot({ path: '.tools/screenshots/post-metadata-desktop.png' });
  await page.setViewportSize({ width: 320, height: 850 });
  await page.screenshot({ path: '.tools/screenshots/post-metadata-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(`${origin}${base}/categories/life/sports/`);
  assert.equal(await page.locator(`a[href="${base}/posts/billiards-teaching-20261103/"]`).count(), 1);
  await page.goto(`${origin}${base}/archive/`);
  assert.match(await page.locator('.u-archive-clock').first().innerText(), /\d{2}:\d{2}:\d{2}/);
  assert.ok(await page.locator('.u-archive-updated').count() > 0);
  assert.ok(await page.locator('.u-archive-item > time[title*="仅精确到日期"]').count() > 0);
  await page.locator('[data-visitor-location]').evaluate(el => { el.textContent = '中国 · 内蒙古自治区 · 呼和浩特市一个较长的区域名称'; });
  await page.locator('#busuanzi_value_site_pv').evaluate(el => { el.textContent = '99999999999999999'; el.parentElement.style.display = 'inline'; });
  await page.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u-header-height')) - document.querySelector('.u-header-shell').getBoundingClientRect().height) < 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '长地区与大计数可换行');
  const header = await page.locator('.u-header-shell').boundingBox();
  const main = await page.locator('#main-content').boundingBox();
  assert.ok(main.y >= header.y + header.height, '导航增长后不会遮挡正文');
  await page.screenshot({ path: '.tools/screenshots/post-metadata-long-header.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: 运动子分类/贴图筛选、创建时间排序、创建与编辑秒数、详情/归档、320px 长导航布局。');
} finally { await browser.close(); }
