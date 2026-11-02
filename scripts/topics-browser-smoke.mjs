import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const screenshots = path.resolve('.tools/screenshots');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (base && !pathname.startsWith(`${base}/`)) { res.writeHead(404); res.end(); return; }
  const file = path.resolve(dist, pathname.slice(base.length).replace(/^\/+/, ''), pathname.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(`${dist}${path.sep}`)) { res.writeHead(403); res.end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}${base}/`;
let executablePath = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  if (executablePath) break;
  try { await access(candidate); executablePath = candidate; } catch { /* Next browser. */ }
}
let browser;
try {
  assert.ok(executablePath, 'Chrome must be installed');
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });
  await mkdir(screenshots, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('[data-entry-gate]') || document.documentElement.dataset.entryInitialized === 'true');
  if (await page.locator('[data-entry-skip]').isVisible()) await page.locator('[data-entry-skip]').click();
  const navigation = page.locator('[data-topic-navigation]');
  assert.equal(await navigation.count(), 1, 'home must expose one category navigation');
  const rail = await navigation.boundingBox();
  const list = await page.locator('[data-post-list]').boundingBox();
  assert.ok(rail.x + rail.width <= list.x, 'desktop categories must be left of articles');
  assert.equal(await page.locator('.u-sidebar').isVisible(), true, 'original right sidebar stays on the right');
  const originalSidebar = await page.locator('.u-sidebar').boundingBox();
  assert.ok(originalSidebar.x >= list.x + list.width, 'original sidebar remains to the right of the article list');
  assert.equal(await navigation.locator('[data-topic-filter="技术/AI"]').count(), 0, 'left category rail shows roots only');
  assert.equal(await page.locator('[data-subcategory-group]:visible').count(), 0, 'no subcategory row before choosing a root');
  assert.equal(await page.locator('.u-topic-sidebar .u-side-tags').count(), 0, 'existing tags do not move to the category rail');
  assert.equal(await navigation.getByText('随想', { exact: true }).count(), 0);
  assert.equal(await navigation.getByText('Go', { exact: true }).count(), 0, 'empty topics stay out of navigation');
  const visible = () => page.locator('[data-post-list] article:visible').count();
  const total = await visible();
  assert.equal(total, 4);
  await navigation.locator('[data-topic-filter="技术"]').click();
  assert.equal(await visible(), 3);
  assert.equal(new URL(page.url()).searchParams.get('topic'), 'technology');
  const technologyTabs = page.locator('[data-subcategory-group="技术"]');
  assert.equal(await technologyTabs.isVisible(), true);
  assert.equal(await technologyTabs.locator('[data-topic-filter="技术"]').getAttribute('aria-current'), 'true', 'root selection defaults to all its articles');
  assert.deepEqual(await technologyTabs.locator('a').allTextContents(), ['全部', 'AI']);
  await page.locator('[data-topic-filter="技术/AI"]').click();
  assert.equal(await visible(), 3);
  assert.equal(await navigation.locator('[data-topic-filter="技术"]').getAttribute('aria-current'), 'true', 'root stays selected when a child is selected');
  assert.equal(await page.locator('#recent-title').textContent(), '最近记录', 'original list heading stays unchanged');
  await page.screenshot({ path: path.join(screenshots, 'topics-selected-desktop.png'), fullPage: true });
  await technologyTabs.locator('[data-topic-filter="技术"]').click();
  assert.equal(await visible(), 3);
  assert.equal(new URL(page.url()).searchParams.get('topic'), 'technology');
  await page.locator('[data-topic-filter="技术/AI"]').click();
  await page.locator('[data-filter="photo"]').click();
  assert.equal(await visible(), 0);
  assert.equal(await page.locator('[data-filter-empty]').isVisible(), true);
  await navigation.locator('[data-topic-filter="生活"]').click();
  assert.equal(await visible(), 1, 'changing category preserves the photo filter');
  assert.equal(await technologyTabs.isVisible(), false);
  assert.equal(await page.locator('[data-subcategory-group="生活"]').isVisible(), true);
  assert.equal(await page.locator('[data-subcategory-group="生活"] [data-topic-filter="生活"]').getAttribute('aria-current'), 'true', 'switching roots clears the previous child selection');
  await page.reload();
  assert.equal(await visible(), 1);
  assert.equal(await page.locator('[data-filter="photo"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-filter="all"]').click();
  await page.goBack();
  assert.equal(await page.locator('[data-filter="photo"]').getAttribute('aria-pressed'), 'true');
  await page.goForward();
  assert.equal(await page.locator('[data-filter="all"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-filter="all"]').click();
  await navigation.locator('[data-topic-filter=""]').click();
  assert.equal(await visible(), total);
  assert.equal(new URL(page.url()).search, '');
  assert.equal(await page.locator('[data-subcategory-group]:visible').count(), 0);
  await page.screenshot({ path: path.join(screenshots, 'topics-desktop.png'), fullPage: true });
  const originalUrl = page.url();
  const popupPromise = context.waitForEvent('page');
  await navigation.locator('[data-topic-filter="技术"]').click({ modifiers: ['ControlOrMeta'] });
  const popup = await popupPromise;
  await popup.waitForLoadState();
  assert.ok(popup.url().endsWith('/categories/technology/'), 'modified click opens the real category link');
  assert.equal(page.url(), originalUrl, 'modified click does not change the current filter');
  await popup.close();

  // Simulate an entry outside the original page, before the enhancement runs.
  await page.route(url, async route => {
    const response = await route.fetch();
    let html = await response.text();
    const start = html.indexOf('<article class="u-post"');
    const end = html.indexOf('</article>', start) + '</article>'.length;
    assert.ok(start >= 0 && end > start);
    const article = html.slice(start, end).replace(/data-initial="[^"]*"/, 'data-initial="false"').replace('<article ', '<article hidden data-fixture="off-page" ');
    html = html.slice(0, end) + article + '<nav class="u-pagination" data-fixture="pagination">第 1 / 2 页</nav>' + html.slice(end);
    await route.fulfill({ response, body: html });
  });
  await page.goto(url);
  assert.equal(await page.locator('[data-fixture="off-page"]').isVisible(), false);
  assert.equal(await page.locator('[data-fixture="pagination"]').isVisible(), true);
  const fixtureCategory = await page.locator('[data-fixture="off-page"]').getAttribute('data-category');
  await navigation.locator(`[data-topic-filter="${fixtureCategory.split('/')[0]}"]`).click();
  if (fixtureCategory.includes('/')) await page.locator(`[data-subcategory-group] [data-topic-filter="${fixtureCategory}"]`).click();
  assert.equal(await page.locator('[data-fixture="off-page"]').isVisible(), true, 'filters must find off-page content');
  assert.equal(await page.locator('[data-fixture="pagination"]').isVisible(), false);
  await navigation.locator('[data-topic-filter=""]').click();
  assert.equal(await page.locator('[data-fixture="off-page"]').isVisible(), false, 'reset restores initial pagination');
  assert.equal(await page.locator('[data-fixture="pagination"]').isVisible(), true, 'reset restores pagination controls');
  const fixtureKind = await page.locator('[data-fixture="off-page"]').getAttribute('data-kind');
  await page.locator(`[data-filter="${fixtureKind}"]`).click();
  assert.equal(await page.locator('[data-fixture="off-page"]').isVisible(), true, 'kind alone must also find off-page content');
  assert.equal(await page.locator('[data-fixture="pagination"]').isVisible(), false);
  await page.locator('[data-filter="all"]').click();
  assert.equal(await page.locator('[data-fixture="off-page"]').isVisible(), false);
  assert.equal(await page.locator('[data-fixture="pagination"]').isVisible(), true);
  await page.unroute(url);

  await page.setViewportSize({ width: 640, height: 850 });
  await page.goto(url);
  const articleColumn = await page.locator('[aria-labelledby="recent-title"]').boundingBox();
  const typeControls = await page.locator('.u-filter').boundingBox();
  assert.ok(typeControls.x + typeControls.width <= articleColumn.x + articleColumn.width + 1, 'tablet filter controls must fit the article column beside the original right sidebar');
  assert.equal(await page.locator('.u-filter button').evaluateAll(buttons => buttons.every(button => {
    const range = document.createRange();
    range.selectNodeContents(button);
    return range.getClientRects().length === 1;
  })), true, 'tablet kind-filter labels must remain readable on one line');

  for (const width of [900, 760, 640, 581, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(url);
    assert.equal(await navigation.isVisible(), true);
    const navBox = await navigation.boundingBox();
    const listBox = await page.locator('[data-post-list]').boundingBox();
    assert.ok(navBox.y + navBox.height <= listBox.y, 'mobile categories must appear above articles');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    await navigation.locator('[data-topic-filter="技术"]').click();
    await page.locator('[data-topic-filter="技术/AI"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await visible(), 3);
    await page.screenshot({ path: path.join(screenshots, `topics-mobile-${width}.png`), fullPage: true });
  }
  await page.goto(`${url}categories/technology/`);
  assert.equal(await visible(), 3);
  await page.locator('[data-filter="photo"]').click();
  assert.equal(await visible(), 0);
  assert.equal(await page.locator('[data-filter-empty]').isVisible(), true);

  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 850 } });
  const fallback = await noJs.newPage();
  await fallback.goto(url);
  await fallback.locator('[data-topic-navigation]').getByRole('link', { name: '技术', exact: false }).click();
  assert.ok(fallback.url().endsWith('/categories/technology/'));
  await fallback.locator('[data-topic-navigation]').getByRole('link', { name: 'AI', exact: false }).click();
  assert.ok(fallback.url().endsWith('/categories/technology/ai/'));
  assert.equal(await fallback.locator('[data-post-list] article').count(), 3);
  assert.equal(await fallback.locator('.u-category').getByRole('link').count(), 6, 'each article exposes parent and child breadcrumb links');
  await fallback.goto(`${url}categories/practice/`);
  await fallback.waitForURL('**/categories/technology/');
  assert.equal(await fallback.locator('[data-post-list] article').count(), 3);
  assert.deepEqual(errors, []);
  console.log('分类浏览器检查通过：左侧仅一级分类、原右栏保留、列表上方子分类与全部、切换父分类重置、类型组合、URL恢复、跨分页、手机与静态导航。');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
