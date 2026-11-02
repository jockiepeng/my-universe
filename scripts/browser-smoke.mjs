import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';
import { getDailyMotion } from '../src/lib/motion.mjs';

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
const browser = await chromium.launch({ executablePath: executable, headless: true, args: ['--enable-unsafe-swiftshader'] });
const checks = [];
async function skipEntry(page) {
  await page.waitForFunction(() => !document.querySelector('[data-entry-gate]') || document.documentElement.dataset.entryInitialized === 'true');
  if (await page.locator('html').getAttribute('data-entry') === 'open') await page.locator('[data-entry-skip]').click();
}
try {
  const openingContext = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const openingPage = await openingContext.newPage();
  const openingErrors = [];
  openingPage.on('pageerror', error => openingErrors.push(error.message));
  await openingPage.goto(url);
  await openingPage.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
  assert.equal(await openingPage.locator('[data-entry-gate]').getAttribute('data-state'), 'playing');
  assert.equal(await openingPage.locator('.u-page').evaluate(el => el.inert), true);
  assert.equal(await openingPage.locator('[data-entry-enter]').isVisible(), false);
  await openingPage.waitForFunction(() => document.querySelector('[data-entry-gate]').dataset.state === 'ready', null, { timeout: 10000 });
  await openingPage.waitForTimeout(800);
  await openingPage.screenshot({ path: path.join(screenshots, 'entry-daily.png') });
  await openingPage.keyboard.press('Tab');
  assert.equal(await openingPage.locator('[data-entry-enter]').evaluate(el => el === document.activeElement), true);
  await openingPage.keyboard.press('Tab');
  assert.equal(await openingPage.locator('[data-entry-skip]').evaluate(el => el === document.activeElement), true);
  await openingPage.locator('[data-entry-enter]').click();
  assert.equal(await openingPage.locator('html').getAttribute('data-entry'), null);
  assert.equal(await openingPage.locator('.u-page').evaluate(el => el.inert), false);
  assert.equal(await openingPage.locator('#main-content').evaluate(el => el === document.activeElement), true);
  await openingPage.reload();
  await openingPage.waitForFunction(() => document.documentElement.dataset.entryInitialized === 'true');
  assert.equal(await openingPage.locator('[data-entry-gate]').isVisible(), false, '同一会话当天刷新不重复开场');
  for (const scene of ['galaxy', 'aurora', 'ocean']) {
    await openingPage.locator('[data-scene-toggle]').click();
    await openingPage.locator(`[data-scene-option="${scene}"]`).click();
    assert.equal(await openingPage.locator('html').getAttribute('data-scene'), scene);
    assert.equal(await openingPage.locator('[data-home-scene]').getAttribute('data-renderer'), 'webgl');
    await openingPage.screenshot({ path: path.join(screenshots, `home-${scene}.png`) });
  }
  for (const style of ['particles', 'portal']) {
    await openingPage.locator('[data-scene-toggle]').click();
    await openingPage.locator(`[data-opening-option="${style}"]`).click();
    await openingPage.locator('[data-intro-replay]').click();
    assert.equal(await openingPage.locator('[data-entry-gate]').getAttribute('data-opening'), style);
    await openingPage.waitForFunction(() => document.querySelector('[data-entry-gate]').dataset.state === 'ready', null, { timeout: 10000 });
    await openingPage.waitForTimeout(800);
    await openingPage.screenshot({ path: path.join(screenshots, `entry-${style}.png`) });
    await openingPage.locator('[data-entry-enter]').click();
  }
  await openingPage.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 320]) {
    await openingPage.setViewportSize({ width, height: 760 });
    await openingPage.locator('[data-scene-toggle]').click(); await openingPage.locator('[data-intro-replay]').click();
    await openingPage.waitForFunction(() => document.querySelector('[data-entry-gate]').dataset.state === 'ready');
    const entryButton = await openingPage.locator('[data-entry-enter]').boundingBox();
    assert.ok(entryButton.x >= 0 && entryButton.x + entryButton.width <= width && entryButton.y + entryButton.height < 760);
    assert.ok(await openingPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await openingPage.screenshot({ path: path.join(screenshots, `entry-mobile-${width}.png`) });
    await openingPage.locator('[data-entry-enter]').click();
  }
  assert.deepEqual(openingErrors, []);
  await openingContext.close();
  checks.push('首次首页开场结束才出现进入按钮，键盘焦点留在开场内，进入后恢复阅读');
  checks.push('同会话当天不重复开场，三种 WebGL 背景和两种开场可手动选择、重播');
  const tailContext = await browser.newContext();
  const tailPage = await tailContext.newPage();
  await tailPage.clock.install({ time: new Date('2026-11-02T15:59:57Z') });
  await tailPage.clock.pauseAt(new Date('2026-11-02T15:59:58Z'));
  await tailPage.goto(url); await skipEntry(tailPage);
  await tailPage.locator('[data-scene-toggle]').click(); await tailPage.locator('[data-scene-option="ocean"]').click();
  assert.equal(await tailPage.locator('html').getAttribute('data-scene-mode'), 'manual');
  await tailPage.clock.runFor(3000);
  assert.equal(await tailPage.locator('html').getAttribute('data-motion-day'), '2026-11-03');
  assert.equal(await tailPage.locator('html').getAttribute('data-scene-mode'), 'daily');
  assert.equal(await tailPage.locator('html').getAttribute('data-scene'), getDailyMotion(new Date('2026-11-03T00:00:01+08:00')).scene);
  assert.equal(await tailPage.locator('html').getAttribute('data-entry'), null);
  await tailContext.close(); checks.push('上海午夜自动轮换背景，手动选择次日过期，阅读不被重新开场打断');

  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await skipEntry(page);
  await page.waitForFunction(() => document.querySelector('[data-home-scene]')?.dataset.state === 'running');
  const background = await page.locator('[data-home-scene]').boundingBox();
  assert.deepEqual([background.x, background.y, background.width, background.height], [0, 0, 1360, 1000], '动画背景应覆盖整个视口');
  assert.equal(await page.locator('.u-post').count(), 3, '首页包含两篇长文与人缘贴图');
  assert.equal(await page.locator('#daily-quote-title').innerText(), '随想');
  assert.equal(await page.locator('[data-daily-quote] time, [data-quote-source]').count(), 0);
  await page.locator('[data-daily-quote][data-quote-id]:not([data-quote-id=""])').waitFor();
  const dailyText = await page.locator('[data-quote-text]').innerText();
  await page.reload();
  assert.equal(await page.locator('[data-quote-text]').innerText(), dailyText, '同日刷新每日一句应保持一致');
  const firstFrame = await page.locator('[data-home-scene]').screenshot();
  await page.waitForTimeout(150);
  assert.notDeepEqual(await page.locator('[data-home-scene]').screenshot(), firstFrame);
  await page.screenshot({ path: path.join(screenshots, 'home-space-light.png'), fullPage: false });
  await page.locator('[data-daily-quote]').screenshot({ path: path.join(screenshots, 'home-thought-desktop.png') });
  await page.locator('[data-motion-toggle]').click();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('[data-home-scene]')?.dataset.state === 'paused');
  const pausedFrame = await page.locator('[data-home-scene]').screenshot();
  await page.waitForTimeout(150);
  assert.deepEqual(await page.locator('[data-home-scene]').screenshot(), pausedFrame);
  await page.locator('[data-motion-toggle]').click();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('[data-home-scene]')?.dataset.state === 'running');
  checks.push('首页画布持续更新，关闭动态后停止绘制');
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 320);
  await page.waitForFunction(() => scrollY > 50, null, { timeout: 2500 });
  const scrolledBackground = await page.locator('[data-home-scene]').boundingBox();
  assert.equal(scrolledBackground.y, 0, '滚动后整页动画背景仍覆盖视口');
  await page.mouse.wheel(0, -1000);
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 2500 });
  checks.push('首页使用真实滚轮可上下滚动');
  assert.equal(await page.title(), 'jockie的小宇宙');
  assert.match(await page.locator('.u-brand').innerText(), /jockie的小宇宙/);
  assert.match(await page.locator('.u-footer').innerText(), /jockie的小宇宙/);
  await page.locator('[data-clock-toggle]').click();
  await page.locator('[data-live-clock]').waitFor({ state: 'visible' });
  checks.push('站名统一，首页显示实时时钟与月历');
  async function checkPageChrome(target) {
    await target.waitForFunction(() => {
      const header = document.querySelector('.u-header-shell');
      const page = document.querySelector('.u-page');
      return header && page && Math.abs(header.getBoundingClientRect().top) <= 1 && parseFloat(getComputedStyle(page).paddingTop) >= header.getBoundingClientRect().height;
    });
    assert.equal(await target.locator('.u-footer-shell').evaluate(el => getComputedStyle(el).position), 'static');
    assert.equal(await target.locator('.u-header-shell').evaluate(el => getComputedStyle(el).position), 'fixed');
  }
  await checkPageChrome(page);
  await page.setViewportSize({ width: 1360, height: 600 });
  await checkPageChrome(page);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.goto(`${url}about/`);
  await checkPageChrome(page);
  await page.goto(url);
  await skipEntry(page);
  const dateContext = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const dated = await dateContext.newPage();
  await dated.clock.install({ time: new Date('2026-12-31T15:59:57Z') });
  await dated.clock.pauseAt(new Date('2026-12-31T15:59:58Z'));
  await dated.goto(url);
  await skipEntry(dated);
  assert.equal(await dated.locator('html').getAttribute('data-scene'), getDailyMotion(new Date('2026-12-31T23:59:58+08:00')).scene);
  await dated.locator('[data-clock-toggle]').click();
  await dated.locator('[data-live-clock]').waitFor({ state: 'visible' });
  await dated.waitForFunction(() => document.querySelector('[data-daily-quote]')?.dataset.quoteDay === '2026-12-31');
  assert.equal(await dated.locator('[data-clock-time]').innerText(), '23:59:58');
  assert.equal(await dated.locator('[data-countdown="year-2027"] [data-countdown-clock]').innerText(), '00:00:02');
  assert.equal(await dated.locator('[aria-current="date"]').getAttribute('datetime'), '2026-12-31');
  await dated.clock.runFor(3000);
  assert.equal(await dated.locator('[data-daily-quote]').getAttribute('data-quote-day'), '2027-01-01', '随想应在上海午夜更新内部日期');
  assert.equal(await dated.locator('html').getAttribute('data-motion-day'), '2027-01-01');
  assert.equal(await dated.locator('html').getAttribute('data-entry'), null, '午夜不能重新打断阅读');
  assert.equal(await dated.locator('[data-clock-time]').innerText(), '00:00:01');
  assert.equal(await dated.locator('[data-calendar-month]').innerText(), '2027 年 1 月');
  assert.equal(await dated.locator('[aria-current="date"]').getAttribute('datetime'), '2027-01-01');
  assert.equal(await dated.locator('[data-countdown="year-2027"] [data-countdown-reached]').isVisible(), true);
  assert.equal(await dated.locator('[data-countdown="spring-2027"] [data-countdown-days]').innerText(), '35');
  assert.equal(await dated.locator('[data-countdown="spring-2027"] [data-countdown-clock]').innerText(), '23:59:59');
  await dated.locator('[data-clock-time]').click();
  assert.equal(await dated.locator('#calendar-panel').isVisible(), true, '点击弹层内文字不能关闭日历');
  await dated.locator('[data-calendar-prev]').click();
  assert.equal(await dated.locator('[data-calendar-month]').innerText(), '2026 年 12 月');
  await dated.locator('[data-calendar-next]').click();
  assert.equal(await dated.locator('[data-calendar-month]').innerText(), '2027 年 1 月');
  await dated.locator('[data-calendar-jump]').fill('2024-02');
  await dated.locator('[data-calendar-jump]').dispatchEvent('change');
  assert.equal(await dated.locator('[data-calendar-days] time').count(), 29);
  await dated.clock.runFor(2000);
  assert.equal(await dated.locator('[data-calendar-month]').innerText(), '2024 年 2 月', '时钟更新不应重置浏览月份');
  await dated.locator('[data-calendar-current]').click();
  assert.equal(await dated.locator('[data-calendar-month]').innerText(), '2027 年 1 月');
  await dateContext.close();
  checks.push('实时时钟逐秒更新，上海午夜跨年同步刷新日期和月历');
  checks.push('2027 元旦到期显示已到达，春节倒计时继续按秒更新');
  checks.push('日历支持跨年翻月、指定年月、回到本月，弹层内部点击保持打开');
  checks.push('随想只显示标题和句子，同日稳定，上海午夜自动更新');
  await page.locator('[data-scene-toggle]').click();
  await page.locator('[data-scene-option="ocean"]').click();
  assert.equal(await page.locator('html').getAttribute('data-scene'), 'ocean');
  await page.locator('[data-theme-toggle]').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: path.join(screenshots, 'home-beach-dark.png'), fullPage: false });
  await page.locator('[data-daily-quote]').screenshot({ path: path.join(screenshots, 'home-thought-beach.png') });
  await page.getByRole('link', { name: 'AI探索：先搭工具箱，再让 AI 帮我做一个博客', exact: true }).click();
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.motionDay));
  assert.equal(await page.locator('canvas').count(), 0, '文章阅读页不包含动画画布');
  assert.equal(await page.locator('html').getAttribute('data-scene'), 'ocean');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.locator('script[src*="busuanzi"]').count(), 0);
  assert.match(await page.locator('[data-page-views]').innerText(), /—/);
  checks.push('背景与主题在文章页面保持，本地不请求真实计数');
  await page.reload();
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.motionDay));
  assert.equal(await page.locator('html').getAttribute('data-scene'), 'ocean');
  checks.push('刷新恢复背景');
  const tocWheelTarget = await page.locator('.u-toc').boundingBox();
  await page.mouse.move(tocWheelTarget.x + 30, tocWheelTarget.y + 35);
  await page.mouse.wheel(0, 350);
  await page.waitForFunction(() => scrollY > 50, null, { timeout: 2500 });
  await page.mouse.wheel(0, -1500);
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 2500 });
  checks.push('鼠标停在右侧目录时，滚轮仍能上下滚动正文');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await page.locator('.u-toc a').first().click();
  await page.waitForFunction(() => {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const header = document.querySelector('.u-header-shell').getBoundingClientRect();
    return target && target.getBoundingClientRect().top >= header.bottom && target.getBoundingClientRect().top <= header.bottom + 90;
  });
  checks.push('目录跳转的标题不会被固定导航遮挡');
  const tocBefore = await page.locator('.u-toc').boundingBox();
  const headerBefore = await page.locator('.u-header-shell').boundingBox();
  const footerBefore = await page.locator('.u-footer-shell').boundingBox();
  assert.ok(tocBefore.y >= headerBefore.y + headerBefore.height && tocBefore.y + tocBefore.height <= 1000 - 20, '桌面目录应停留在导航下方的视口内');
  await page.locator('.u-toc a').last().click();
  const tocAfter = await page.locator('.u-toc').boundingBox();
  assert.ok(Math.abs(tocBefore.y - tocAfter.y) <= 1, '切换章节时右侧目录位置应保持稳定');
  checks.push('正文切换章节时，桌面右侧目录保持可见且位置稳定');
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await checkPageChrome(page);
  const overlap = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().bottom > document.querySelector('.u-footer-shell').getBoundingClientRect().top - 20);
  assert.equal(overlap, false, '流动页脚应位于正文之后');
  checks.push('导航固定，页脚随正文排版，正文末尾可完整查看');
  const topArrow = page.getByRole('link', { name: '返回顶部', exact: true });
  await topArrow.waitFor({ state: 'visible' });
  const arrowBox = await topArrow.boundingBox();
  assert.ok(arrowBox.y >= 0 && arrowBox.y + arrowBox.height < 1000, '返回顶部按钮应在视口内');
  await topArrow.click();
  await page.waitForFunction(() => scrollY === 0);
  await topArrow.waitFor({ state: 'hidden' });
  checks.push('文章右侧箭头可直接返回顶部');
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
  await page.goto(url);
  await skipEntry(page);
  await page.locator('[data-daily-quote]').screenshot({ path: path.join(screenshots, 'home-thought-mobile.png') });
  await page.locator('[data-clock-toggle]').click();
  await page.locator('[data-live-clock]').waitFor({ state: 'visible' });
  assert.notEqual(await page.locator('.u-calendar-details').getAttribute('open'), null);
  assert.equal(await page.locator('[data-clock-time]').isVisible(), true);
  assert.equal(await page.locator('[data-countdown="year-2027"]').isVisible(), true);
  assert.equal(await page.locator('[data-countdown="spring-2027"]').isVisible(), true);
  await checkPageChrome(page);
  assert.equal(await page.locator('.u-calendar-grid').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#calendar-panel').isVisible(), false);
  await page.locator('[data-clock-toggle]').click();
  await page.screenshot({ path: path.join(screenshots, 'home-calendar-mobile.png'), fullPage: false });
  checks.push('手机导航紧凑显示日期时间，月历与倒计时弹层支持 Escape');
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(url);
  await skipEntry(page);
  await page.locator('[data-clock-toggle]').click();
  await page.locator('[data-live-clock]').waitFor({ state: 'visible' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px 首页倒计时不能造成横向溢出');
  for (const countdown of await page.locator('[data-countdown]').all()) {
    const box = await countdown.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 320);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}posts/knowledge-base-practice/`);
  assert.equal(await page.locator('.u-toc').getAttribute('open'), null);
  await page.screenshot({ path: path.join(screenshots, 'article-mobile.png'), fullPage: false });
  await page.setViewportSize({ width: 320, height: 760 });
  await checkPageChrome(page);
  await page.locator('[data-scene-toggle]').click();
  const bounds = await page.locator('#scene-picker').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.keyboard.press('Escape');
  checks.push('320px 手机面板与正文无页面横向溢出');
  await page.goto(`${url}posts/knowledge-base-practice/`);
  for (let index = 0; index < 24; index++) {
    await page.keyboard.press('Tab');
    const obscured = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body || active.closest('.u-footer-shell,.u-header-shell') || active.classList.contains('u-skip')) return false;
      const rect = active.getBoundingClientRect();
      const header = document.querySelector('.u-header-shell').getBoundingClientRect();
      return rect.height > 0 && rect.top < header.bottom && rect.bottom > 0;
    });
    assert.equal(obscured, false, '键盘焦点不能被固定导航遮挡');
  }
  checks.push('手机端键盘焦点不被固定导航遮挡');
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.goto(url);
  await skipEntry(page);
  await page.locator('[data-scene-toggle]').click();
  await page.locator('[data-scene-option="galaxy"]').click();
  await page.screenshot({ path: path.join(screenshots, 'home-deep-space.png'), fullPage: false });
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const readable = await noJs.newPage(); await readable.goto(url);
  assert.equal(await readable.locator('[data-entry-gate]').isVisible(), false);
  assert.equal(await readable.locator('#main-content').isVisible(), true);
  await readable.goto(`${url}posts/ai-tools-setup/`);
  assert.match(await readable.locator('.u-article-body').innerText(), /先准备工具/);
  assert.equal(await readable.locator('[data-enhanced]').first().isVisible(), false);
  await checkPageChrome(readable);
  await noJs.close(); checks.push('关闭 JavaScript 仍可阅读');
  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const calm = await reduced.newPage(); await calm.goto(url);
  await calm.waitForFunction(() => document.querySelector('[data-entry-gate]').dataset.state === 'ready');
  assert.equal(await calm.locator('[data-entry-enter]').isVisible(), true, '减少动态时无需等待开场');
  assert.equal(await calm.locator('html').getAttribute('data-motion'), 'off');
  await calm.waitForFunction(() => document.querySelector('[data-home-scene]')?.dataset.state === 'paused');
  await reduced.close(); checks.push('减少动态效果设置生效');
  const stillContext = await browser.newContext();
  await stillContext.addInitScript(() => localStorage.setItem('little-universe-appearance-v1', JSON.stringify({ motion: false })));
  const still = await stillContext.newPage(); await still.goto(url);
  await still.waitForFunction(() => document.querySelector('[data-entry-gate]').dataset.state === 'ready');
  const transitions = await still.locator('.u-entry-gate,.u-entry-gate h2,.u-entry-sub,.u-entry-enter,.u-entry-note').evaluateAll(els => els.map(el => getComputedStyle(el).transitionDuration));
  assert.ok(transitions.every(duration => duration.split(',').every(value => parseFloat(value) === 0)), '手动关闭动态时开场和退场不能保留过渡');
  assert.equal(await still.locator('[data-entry-enter]').isVisible(), true);
  await still.locator('[data-entry-enter]').click();
  await still.locator('[data-entry-gate]').waitFor({ state: 'hidden' });
  await stillContext.close(); checks.push('手动关闭动态直接显示静态结尾，进入与退出均无过渡动画');
  const noGraphics = await browser.newContext();
  await noGraphics.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl' ? null : original.call(this, type, ...args); };
  });
  const fallback = await noGraphics.newPage(); await fallback.goto(url); await skipEntry(fallback);
  assert.equal(await fallback.locator('[data-home-scene]').getAttribute('data-renderer'), 'fallback');
  assert.equal(await fallback.locator('#main-content').isVisible(), true);
  await noGraphics.close(); checks.push('无 WebGL 使用静态背景，开场可跳过并正常阅读');
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  const temporary = await blocked.newPage(); await temporary.goto(url); await skipEntry(temporary);
  await temporary.locator('[data-scene-toggle]').click(); await temporary.locator('[data-scene-option="ocean"]').click();
  assert.equal(await temporary.locator('html').getAttribute('data-scene'), 'ocean');
  await temporary.locator('[data-scene-toggle]').click(); await temporary.locator('[data-opening-option="portal"]').click();
  await temporary.locator('[data-intro-replay]').click();
  assert.equal(await temporary.locator('[data-entry-gate]').getAttribute('data-opening'), 'portal');
  await temporary.locator('[data-entry-skip]').click();
  await blocked.close(); checks.push('存储被禁用时背景切换仍可用');
  for (const [slug, imageCount] of [['ai-tools-setup', 2], ['knowledge-base-practice', 8]]) {
    await page.goto(`${url}posts/${slug}/`);
    const images = page.locator('.u-article-body img');
    assert.equal(await images.count(), imageCount);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(el => el.complete ? Promise.resolve() : new Promise((resolve, reject) => { el.onload = resolve; el.onerror = reject; }));
      assert.ok(await image.evaluate((el, base) => el.naturalWidth > 0 && new URL(el.src).pathname.startsWith(`${base}/_astro/`), base), '迁移配图应从本站构建产物加载');
    }
    assert.equal(await page.locator('canvas').count(), 0);
  }
  checks.push('两篇迁移长文的十张配图可加载，阅读背景无动画画布');
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
  const articleUrl = `${productionOrigin}${base}/posts/ai-tools-setup/`;
  await live.goto(articleUrl);
  await live.waitForFunction(() => document.querySelector('#busuanzi_value_page_pv')?.textContent === '42');
  assert.equal(referrers[0], articleUrl, '计数请求应携带文章路径，避免所有文章合并到域名计数');
  assert.match(await live.locator('[data-page-views]').innerText(), /42/);
  await live.clock.install();
  const lateRequest = live.waitForRequest(request => request.url().includes('/busuanzi?'));
  await live.goto(`${productionOrigin}${base}/posts/knowledge-base-practice/`, { waitUntil: 'domcontentloaded' });
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
