import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';
import corpus from '../src/data/fortune-texts.json' with { type: 'json' };

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
const url = `${origin}${base}/tools/fortune/`;
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Next candidate. */ }
}
const errors = [];
let browser;
const key = 'little-universe-fortunes-v1';
async function localContext(options) {
  const context = await browser.newContext(options);
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  return context;
}
async function ready(page) { await page.locator('[data-fortune][data-ready="true"]').waitFor(); }
async function reading(page, collection, number) {
  const expected = corpus[collection][number - 1];
  assert.equal(await page.locator('[data-result-poem]').isVisible(), true, '完整签诗直接显示在签纸上');
  assert.deepEqual(await page.locator('[data-result-poem] p').allTextContents(), expected.poem);
  assert.equal(await page.locator('[data-result-grade]').textContent(), expected.grade);
  assert.equal(await page.locator('[data-result-interpretation]').textContent(), expected.interpretation);
  assert.equal(await page.locator('[data-source-link]').getAttribute('href'), expected.sourceUrl);
  assert.equal(page.url(), url, '阅签留在本站');
}
async function draw(page) {
  await page.getByRole('button', { name: '求一支签', exact: true }).click();
  await page.locator('[data-fortune][data-phase="drawn"]').waitFor();
  await page.getByRole('button', { name: '展开签纸', exact: true }).click();
  await page.locator('[data-fortune][data-phase="revealed"]').waitFor();
}
async function shot(page, name) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `.tools/screenshots/${name}.png`, fullPage: true });
}
try {
  browser = await chromium.launch({ executablePath: executable, headless: true });
  await mkdir('.tools/screenshots', { recursive: true });
  const desktop = await localContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  const page = await desktop.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}${base}/#main-content`);
  await page.getByRole('link', { name: '求一支签', exact: true }).waitFor();
  await shot(page, 'fortune-home-desktop');
  await page.getByRole('link', { name: '求一支签', exact: true }).click();
  await ready(page);
  assert.equal(new URL(page.url()).pathname, `${base}/tools/fortune/`);
  await page.goto(`${origin}${base}/tools/`);
  await page.getByRole('link', { name: /去求一支签/ }).click();
  await ready(page);
  assert.equal((await page.goto(url)).status(), 200, '求签页面已生成');
  await ready(page);
  assert.equal(await page.locator('.u-nav a[aria-current="page"]').textContent(), '工具');
  await shot(page, 'fortune-desktop-idle');
  await draw(page);
  const first = Number(await page.locator('[data-result-number]').getAttribute('data-number'));
  assert.ok(first >= 1 && first <= 100);
  await reading(page, 'guanyin', first);
  await shot(page, 'fortune-desktop-result');
  await page.reload(); await ready(page);
  assert.equal(Number(await page.locator('[data-result-number]').getAttribute('data-number')), first, '刷新保留结果');
  await reading(page, 'guanyin', first);
  await page.getByRole('button', { name: /车公签.*96/ }).click();
  await draw(page);
  const che = Number(await page.locator('[data-result-number]').getAttribute('data-number'));
  assert.ok(che >= 1 && che <= 96);
  await reading(page, 'chekung', che);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark'; });
  await shot(page, 'fortune-desktop-chekung-dark');
  await page.getByRole('button', { name: /观音签.*100/ }).click();
  assert.equal(Number(await page.locator('[data-result-number]').getAttribute('data-number')), first, '切换保留各自结果');
  await reading(page, 'guanyin', first);
  await page.getByRole('button', { name: '再求一签', exact: true }).click();
  await draw(page);
  await reading(page, 'guanyin', Number(await page.locator('[data-result-number]').getAttribute('data-number')));
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).entries.length, key), 3, '每次抽签只入历史一次');
  await page.locator('[data-history-list] button').nth(1).click();
  await reading(page, 'chekung', che);
  await desktop.close();

  const boundary = await localContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
  const samples = [['guanyin', 1], ['guanyin', 100], ['chekung', 1], ['chekung', 96]];
  await boundary.addInitScript(({ key, samples }) => localStorage.setItem(key, JSON.stringify({ version: 1, entries: samples.map(([collection, number]) => ({ collection, number, drawnAt: '2026-11-04T04:00:00Z' })) })), { key, samples });
  const fixtures = await boundary.newPage();
  await fixtures.goto(url); await ready(fixtures);
  assert.deepEqual(await fixtures.locator('[data-result-poem] p').allTextContents(), ['开天辟地作良缘', '吉日良时万物全', '若得此签非小可', '人行忠正帝王宣']);
  for (let index = 0; index < samples.length; index++) {
    await fixtures.locator('[data-history-list] button').nth(index).click();
    await reading(fixtures, ...samples[index]);
    assert.equal(await fixtures.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await shot(fixtures, `fortune-boundary-${samples[index].join('-')}`);
  }
  assert.deepEqual(await fixtures.locator('[data-result-poem] p').allTextContents(), ['山水相逢淘沙金', '性坚何误小人言', '只管秉心行正道', '举头三尺有神前']);
  await fixtures.setViewportSize({ width: 320, height: 844 });
  await reading(fixtures, 'chekung', 96);
  assert.equal(await fixtures.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '长签号在320px下不溢出');
  assert.equal(await fixtures.locator('[data-result-number]').evaluate(element => {
    const textRange = new Range();
    textRange.selectNodeContents(element);
    return textRange.getClientRects().length;
  }), 1, '三字签号不折行');
  await shot(fixtures, 'fortune-mobile-chekung-96');
  await boundary.close();

  const animated = await localContext({ viewport: { width: 1280, height: 960 }, reducedMotion: 'no-preference' });
  const animation = await animated.newPage();
  animation.on('pageerror', error => errors.push(error.message));
  await animation.goto(url); await ready(animation);
  await animation.getByRole('button', { name: '求一支签', exact: true }).click();
  assert.equal(await animation.locator('[data-fortune]').getAttribute('data-phase'), 'shaking');
  assert.equal(await animation.getByRole('button', { name: /车公签.*96/ }).isDisabled(), true);
  await animation.getByRole('button', { name: '跳过动画', exact: true }).click();
  await animation.getByRole('button', { name: '展开签纸', exact: true }).click();
  await animation.waitForTimeout(2400);
  assert.equal(await animation.evaluate(key => JSON.parse(localStorage.getItem(key)).entries.length, key), 1, '跳过与定时器不能重复保存');
  await animation.getByRole('button', { name: '再求一签', exact: true }).click();
  await animation.getByRole('button', { name: '求一支签', exact: true }).click();
  await animation.locator('[data-fortune][data-phase="drawn"]').waitFor();
  await animation.getByRole('button', { name: '展开签纸', exact: true }).focus();
  await animation.keyboard.press('Enter');
  assert.equal(await animation.locator('[data-fortune]').getAttribute('data-phase'), 'revealed');
  await reading(animation, 'guanyin', Number(await animation.locator('[data-result-number]').getAttribute('data-number')));
  await animated.close();

  const mobile = await localContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await mobile.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new DOMException('blocked', 'SecurityError'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(url); await ready(phone); await draw(phone);
  await reading(phone, 'guanyin', Number(await phone.locator('[data-result-number]').getAttribute('data-number')));
  assert.match(await phone.locator('[data-storage-note]').textContent(), /无法保存/);
  for (const width of [390, 320]) {
    await phone.setViewportSize({ width, height: 844 });
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px 无横向溢出`);
    assert.equal(await phone.locator('[data-source-link]').isVisible(), true);
    assert.equal(await phone.locator('[data-fortune-paper]').evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight), true, '签纸不裁切内容');
    await shot(phone, `fortune-mobile-${width}`);
  }
  await mobile.close();

  const broken = await localContext({ reducedMotion: 'reduce' });
  await broken.addInitScript(key => localStorage.setItem(key, '{bad json'), key);
  const recovery = await broken.newPage();
  await recovery.goto(url); await ready(recovery); await draw(recovery);
  assert.equal(await recovery.evaluate(key => JSON.parse(localStorage.getItem(key)).entries.length, key), 1);
  await broken.close();

  const nojs = await localContext({ javaScriptEnabled: false });
  const staticPage = await nojs.newPage();
  await staticPage.goto(url);
  assert.equal(await staticPage.getByRole('link', { name: '查阅观音签通行本' }).isVisible(), true);
  await nojs.close();
  assert.deepEqual(errors, []);
  console.log('Fortune browser checks passed: local poems/grades/interpretations, first/final signs, both collections, reveal, redraw, history, animation/skip, keyboard, storage failures, no-JS, mobile and screenshots; external requests blocked.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
