import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

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
const url = `${origin}${base}/tools/life/`;
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Try next browser. */ }
}
let browser;
const errors = [];
const today = '2026-11-03';
const expected = { totalDays: 31046, elapsedDays: 13351, remainingDays: 17695, totalWeeks: 4436, elapsedWeeks: 1907, remainingWeeks: 2529 };
const number = value => Number(value.replaceAll(',', '').trim());
async function ready(page) { await page.waitForSelector('[data-life-grid][data-ready="true"]'); }
async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `.tools/screenshots/${name}.png`, fullPage: true });
}
async function submit(page, birth = '1990-04-15', years = '85') {
  await page.locator('[name="birth"]').fill(birth);
  await page.locator('[name="lifespan"]').fill(years);
  await page.getByRole('button', { name: '走一遍我的人生', exact: true }).click();
}
async function verifyCounts(page, week = false) {
  assert.equal(number(await page.locator('[data-life-total]').textContent()), week ? expected.totalWeeks : expected.totalDays);
  assert.equal(number(await page.locator('[data-life-elapsed]').textContent()), week ? expected.elapsedWeeks : expected.elapsedDays);
  assert.equal(number(await page.locator('[data-life-remaining]').textContent()), week ? expected.remainingWeeks : expected.remainingDays);
}
try {
  browser = await chromium.launch({ executablePath: executable, headless: true });
  await mkdir('.tools/screenshots', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /attribute d/.test(message.text())) errors.push(message.text()); });
  await page.clock.install({ time: new Date('2026-11-03T04:00:00Z') });
  assert.equal((await page.goto(`${origin}${base}/tools/`)).status(), 200, '工具区应存在');
  assert.equal(await page.locator('.u-nav a[aria-current="page"]').textContent(), '工具');
  await page.getByRole('link', { name: /角色旅程/ }).click(); await ready(page);
  assert.equal(await page.locator('[data-life-grid]').getAttribute('data-example'), 'true');
  assert.equal(await page.locator('[name="birth"]').inputValue(), '', '不预填个人生日');
  assert.match(await page.locator('[data-life-context]').textContent(), /示例/);
  await submit(page); await verifyCounts(page);
  assert.equal(await page.locator('[data-life-grid]').getAttribute('data-example'), 'false');
  assert.equal(await page.locator('[data-life-grid]').getAttribute('data-animating'), 'false');
  const percent = await page.locator('[data-life-percent]').textContent();
  await page.locator('[data-life-unit="week"]').click(); await verifyCounts(page, true);
  assert.equal(await page.locator('[data-life-unit="week"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-life-percent]').textContent(), percent);
  assert.equal(await page.locator('[name="birth"]').inputValue(), '1990-04-15');
  assert.equal(await page.locator('[data-life-query]').getAttribute('max'), String(expected.totalWeeks));
  await page.locator('[data-life-query]').fill('2');
  await page.getByRole('button', { name: '查看这一格', exact: true }).click();
  assert.match(await page.locator('[data-life-detail]').textContent(), /1990-04-22/);
  assert.match(await page.locator('[data-life-detail]').textContent(), /1990-04-28/);
  await page.locator('[data-life-unit="day"]').click(); await verifyCounts(page);
  await page.locator('[data-life-canvas]').focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.locator('[data-life-viewport]').evaluate(el => getComputedStyle(el).outlineStyle), 'none', '主图键盘查询必须有可见焦点');
  assert.match(await page.locator('[data-life-detail]').textContent(), /1990-04-16/);
  await page.keyboard.press('End');
  assert.match(await page.locator('[data-life-detail]').textContent(), /2075-04-14/);
  await page.locator('[data-life-fullscreen-open]').click();
  await page.locator('[data-life-fullscreen]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-life-fullscreen-plot]').evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1), true, '全屏图完整显示，无内部拖动');
  await page.screenshot({ path: '.tools/screenshots/life-journey-fullscreen.png' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-life-fullscreen-open]').evaluate(el => document.activeElement === el), true, '退出全屏恢复焦点');
  await page.locator('[data-life-wish]').fill('想和在意的人，一起去看更大的世界。');
  await page.locator('[data-life-unit="week"]').click();
  assert.equal(await page.locator('[data-life-wish]').inputValue(), '想和在意的人，一起去看更大的世界。');
  await page.locator('[data-life-unit="day"]').click();
  await page.locator('[data-life-share-open]').click();
  await page.waitForSelector('[data-life-share-dialog][data-ready="true"]');
  assert.equal(await page.locator('[data-life-poster]').evaluate(el => el.naturalWidth), 1600);
  assert.equal(await page.locator('[data-life-poster]').evaluate(el => el.naturalHeight > 2000), true);
  assert.doesNotMatch(await page.locator('[data-life-poster-summary]').textContent(), /1990-04-15/);
  const downloading = page.waitForEvent('download');
  await page.locator('[data-life-download]').click();
  const download = await downloading;
  await download.saveAs('.tools/screenshots/life-journey-poster.png');
  assert.deepEqual([...(await readFile('.tools/screenshots/life-journey-poster.png')).subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  await page.locator('[data-life-include-birth]').check();
  await page.waitForFunction(() => document.querySelector('[data-life-share-dialog]').dataset.ready === 'true' && document.querySelector('[data-life-poster-summary]').textContent.includes('1990-04-15'));
  await page.locator('[data-life-share-close]').click();
  await page.locator('[data-life-unit="week"]').click();
  await page.locator('[data-life-share-open]').click();
  await page.waitForSelector('[data-life-share-dialog][data-ready="true"]');
  assert.match(await page.locator('[data-life-poster-summary]').textContent(), /4,436 格/);
  const weekDownloading = page.waitForEvent('download');
  await page.locator('[data-life-download]').click();
  await (await weekDownloading).saveAs('.tools/screenshots/life-journey-week-poster.png');
  await page.locator('[data-life-share-close]').click();
  await page.locator('[data-life-unit="day"]').click();
  await screenshot(page, 'life-grid-desktop');
  for (const scene of ['galaxy', 'ocean']) for (const theme of ['light', 'dark']) {
    await page.evaluate(({ scene, theme }) => { document.documentElement.dataset.scene = scene; document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; }, { scene, theme });
    await screenshot(page, `life-grid-${scene}-${theme}`);
  }
  await submit(page, '2026-11-04');
  assert.equal(await page.locator('[name="birth"]').evaluate(el => el.validity.valid), false, '未来出生日期被拒绝');
  await verifyCounts(page);
  await submit(page, '2000-01-01', '0');
  assert.equal(await page.locator('[name="lifespan"]').evaluate(el => el.validity.valid), false);
  await submit(page, '2000-01-01', '1');
  assert.equal(number(await page.locator('[data-life-remaining]').textContent()), 0);
  assert.match(await page.locator('[data-life-message]').textContent(), /调整预计寿命/);
  await submit(page, today, '80');
  assert.equal(number(await page.locator('[data-life-elapsed]').textContent()), 0);
  assert.match(await page.locator('[data-life-detail]').textContent(), /2026-11-03/);
  await page.clock.fastForward(86_400_000);
  assert.equal(number(await page.locator('[data-life-elapsed]').textContent()), 1, '跨天后自动刷新已走过天数');
  assert.match(await page.locator('[data-life-detail]').textContent(), /2026-11-04/);
  const personalStorage = await page.evaluate(() => Object.keys(localStorage).filter(key => /life|birth/i.test(key)));
  assert.deepEqual(personalStorage, [], '个人生日不存储');
  assert.equal(new URL(page.url()).search, '', '输入不写入 URL');
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.clock.install({ time: new Date('2026-11-03T04:00:00Z') });
  await phone.goto(url); await ready(phone); await submit(phone);
  for (const width of [390, 320]) {
    await phone.setViewportSize({ width, height: 844 });
    await phone.locator('[data-life-unit="day"]').click(); await verifyCounts(phone);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px 无横向溢出`);
    const menu = phone.locator('[data-header-menu-toggle]');
    if (await menu.isVisible()) {
      await menu.click();
      await phone.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '工具', exact: true }).waitFor({ state: 'visible' });
    }
    const navOverlap = await phone.evaluate(() => {
      const actions = document.querySelector('.u-actions').getBoundingClientRect();
      return [...document.querySelectorAll('.u-nav a')].some(link => {
        const rect = link.getBoundingClientRect();
        return rect.left < actions.right && rect.right > actions.left && rect.top < actions.bottom && rect.bottom > actions.top;
      });
    });
    assert.equal(navOverlap, false, `${width}px 导航和操作按钮不能重叠`);
    if (await menu.isVisible()) await menu.click();
    await screenshot(phone, `life-grid-mobile-${width}`);
    await phone.locator('[data-life-unit="week"]').click(); await verifyCounts(phone, true);
  }
  await phone.locator('[data-life-fullscreen-open]').click();
  for (const viewport of [{ width: 320, height: 844 }, { width: 844, height: 390 }]) {
    await phone.setViewportSize(viewport);
    await phone.locator('[data-life-fullscreen-query]').fill('4436');
    await phone.locator('[data-life-fullscreen-query-form] button[type="submit"]').click();
    assert.match(await phone.locator('[data-life-fullscreen-detail]').textContent(), /2075-04-14/);
    assert.equal(await phone.locator('[data-life-fullscreen-plot]').evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1), true);
    await phone.screenshot({ path: `.tools/screenshots/life-journey-fullscreen-${viewport.width}.png` });
  }
  await phone.locator('[data-life-fullscreen-close]').click();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.close();

  const normal = await browser.newContext({ reducedMotion: 'no-preference' });
  const animated = await normal.newPage();
  animated.on('pageerror', error => errors.push(error.message));
  await animated.clock.setFixedTime(new Date('2026-11-03T04:00:00Z'));
  await animated.goto(url); await ready(animated);
  await submit(animated);
  assert.equal(await animated.locator('[data-life-grid]').getAttribute('data-animating'), 'true');
  assert.equal(await animated.locator('[data-life-grid]').getAttribute('data-phase'), 'journey');
  assert.equal(await animated.locator('[data-life-camera]').count(), 2, '可选择跟随脚步或看完整人生地面');
  await animated.locator('[data-life-walker] .is-walking').waitFor({ state: 'attached' });
  await animated.locator('[data-life-pause]').click();
  const walkingState = await animated.locator('[data-life-grid]').evaluate(el => ({ phase: el.dataset.phase, animating: el.dataset.animating, walker: el.querySelector('[data-life-walker]').innerHTML, motion: document.documentElement.dataset.motion }));
  assert.deepEqual(errors, [], '演出中不能产生脚本错误');
  assert.equal(await animated.locator('[data-life-walker] .is-walking').count(), 1, JSON.stringify(walkingState));
  assert.match(await animated.locator('[data-life-walker] .is-active .lc-sprite').evaluate(el => getComputedStyle(el).backgroundImage), /characters-v2\.png/, '使用新的完整人物动画图集');
  await animated.locator('[data-life-result]').screenshot({ path: '.tools/screenshots/life-journey-walking.png' });
  const pausedDate = await animated.locator('[data-life-walker-label]').textContent();
  await animated.waitForTimeout(350);
  assert.equal(await animated.locator('[data-life-walker-label]').textContent(), pausedDate, '暂停时日期和脚点停止');
  await animated.locator('[data-life-camera="all"]').click();
  await animated.waitForTimeout(100);
  await animated.locator('[data-life-result]').screenshot({ path: '.tools/screenshots/life-stones-all.png' });
  assert.equal(await animated.locator('[data-life-camera="all"]').getAttribute('aria-pressed'), 'true');
  await animated.locator('[data-life-camera="follow"]').click();
  await animated.locator('[data-life-pause]').click();
  await animated.locator('[data-life-skip]').click();
  assert.equal(await animated.locator('[data-life-grid]').getAttribute('data-phase'), 'overview');
  await animated.locator('[data-life-replay]').click();
  assert.equal(await animated.locator('[data-life-grid]').getAttribute('data-phase'), 'journey');
  await animated.locator('[data-life-unit="week"]').click();
  await animated.waitForSelector('[data-life-grid][data-animating="false"]');
  await animated.locator('[data-life-replay]').click();
  await animated.waitForSelector('[data-life-grid][data-phase="turn"]', { timeout: 20_000 });
  await animated.waitForSelector('[data-life-grid][data-phase="overview"]');
  assert.equal(await animated.locator('[data-life-future]').isVisible(), true, '自然结束后展示未来寄语');
  await verifyCounts(animated, true);
  // A short expired life must stop at its actual final tile, including a partial week.
  await submit(animated, '2000-01-01', '1');
  await animated.waitForSelector('[data-life-grid][data-phase="turn"]', { timeout: 15_000 });
  assert.match(await animated.locator('[data-life-walker-label]').textContent(), /2000-12-31/);
  assert.equal(await animated.locator('[data-life-grid]').getAttribute('data-current-stage'), 'baby');
  await animated.locator('[data-life-skip]').click();
  await animated.setViewportSize({ width: 390, height: 844 });
  await animated.locator('[data-life-unit="day"]').click();
  await submit(animated);
  await animated.waitForTimeout(2600);
  await animated.locator('[data-life-pause]').click();
  await animated.locator('[data-life-result]').screenshot({ path: '.tools/screenshots/life-stones-mobile.png' });
  await animated.locator('[data-life-camera="all"]').click();
  await animated.waitForTimeout(100);
  await animated.locator('[data-life-result]').screenshot({ path: '.tools/screenshots/life-stones-mobile-all.png' });
  assert.equal(await animated.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await animated.locator('[data-life-viewport]').evaluate(el => {
    const plot = el.getBoundingClientRect(), label = el.querySelector('[data-life-walker-label]').getBoundingClientRect();
    return label.left >= plot.left && label.right <= plot.right;
  }), true, '手机全景靠边时日期标签仍完整可读');
  await animated.evaluate(() => document.documentElement.dataset.motion = 'off');
  await submit(animated);
  assert.equal(await animated.locator('[data-life-grid]').getAttribute('data-animating'), 'false');
  await normal.close();

  const native = await browser.newContext({ reducedMotion: 'reduce' });
  await native.route('**/images/life/characters-v2.png', route => route.abort());
  await native.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.__lifeSharedFile = { name: data.files[0].name, size: data.files[0].size };
      throw new DOMException('cancelled', 'AbortError');
    } });
  });
  const sharing = await native.newPage();
  sharing.on('pageerror', error => errors.push(error.message));
  await sharing.goto(url); await ready(sharing);
  await sharing.locator('[data-life-wish]').fill('👨‍👩‍👧‍👦'.repeat(85));
  assert.equal(await sharing.locator('[data-life-wish-count]').textContent(), '80 / 80');
  await sharing.locator('[data-life-share-open]').click();
  await sharing.waitForSelector('[data-life-share-dialog][data-ready="true"]');
  assert.equal(await sharing.locator('[data-life-poster]').evaluate(el => el.naturalWidth), 1600, '无角色图片也可独立生成分享图');
  assert.match(await sharing.locator('[data-life-poster-summary]').textContent(), /示例/);
  const emojiDownload = sharing.waitForEvent('download');
  await sharing.locator('[data-life-download]').click();
  await (await emojiDownload).saveAs('.tools/screenshots/life-journey-emoji-poster.png');
  await sharing.locator('[data-life-native-share]').click();
  assert.match(await sharing.locator('[data-life-share-status]').textContent(), /取消/);
  assert.ok((await sharing.evaluate(() => window.__lifeSharedFile)).size > 10000);
  assert.equal(await sharing.locator('[data-life-share-dialog]').isVisible(), true);
  await native.close();

  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await nojs.newPage();
  await staticPage.goto(url);
  assert.match(await staticPage.locator('[data-life-grid] noscript').textContent(), /启用 JavaScript/);
  assert.equal(await staticPage.getByRole('button', { name: '走一遍我的人生', exact: true }).isDisabled(), true, '无 JS 不提交出生日期');
  await nojs.close();
  assert.deepEqual(errors, []);
  console.log('PASS: 日周统计、完整石片地面与角色行走、暂停/恢复/自然结束/跳过重播、终点日期、桌面手机双镜头、全屏横竖屏无拖动、PNG下载与隐私、愿望emoji边界、分享取消、主题、320px、跨天与无JS');
} finally { await browser?.close(); server.close(); }
