import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve('dist');
const base = '/my-universe';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local.test');
  if (!url.pathname.startsWith(`${base}/`)) { res.writeHead(404).end(); return; }
  const file = path.resolve(root, decodeURIComponent(url.pathname.slice(base.length + 1)), url.pathname.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    const type = mime[path.extname(file)] || 'application/octet-stream';
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : data.length - 1, data.length - 1);
      if (start > end) { res.writeHead(416).end(); return; }
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 }).end(data.subarray(start, end + 1));
    } else res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length, 'Accept-Ranges': 'bytes' }).end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const checks = [];
try {
  const manifest = JSON.parse(await readFile('public/audio/manifest.json', 'utf8'));
  assert.equal(manifest.length, 3);
  for (const track of manifest) {
    const data = await readFile(path.join(root, track.file));
    assert.equal(data.length, track.bytes, `${track.title}: 构建产物音频不完整`);
    assert.equal(createHash('sha256').update(data).digest('hex'), track.sha256, `${track.title}: 音频哈希不匹配`);
  }
  checks.push('三首完整 MP3 构建产物与下载字节数及 SHA-256 一致');
  let executable = process.env.BROWSER_PATH;
  if (!executable) for (const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
    try { await access(candidate); executable = candidate; break; } catch { /* next */ }
  }
  assert.ok(executable, 'Set BROWSER_PATH to Chrome or Chromium');
  browser = await chromium.launch({ executablePath: executable, headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}${base}/about/`;
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const audioRequests = [];
  page.on('request', req => { if (req.url().includes('/audio/') && req.url().endsWith('.mp3')) audioRequests.push(req.url()); });
  await page.goto(url);
  await page.locator('[data-music]').waitFor({ state: 'visible', timeout: 5000 });
  const audio = page.locator('[data-music-audio]');
  assert.equal(await audio.getAttribute('src'), null, '首次不应设置音频地址');
  assert.equal(audioRequests.length, 0, '首次不应下载音乐');
  checks.push('首次无自动播放、无音频下载');
  await page.locator('[data-music-summary]').click();
  assert.equal(await page.locator('[data-music-track]').count(), 3);
  const staleContext = await browser.newContext();
  await staleContext.addInitScript(() => localStorage.setItem('little-universe-music-v1', JSON.stringify({ track: 'removed-track', time: 9999, volume: 'bad' })));
  const stale = await staleContext.newPage();
  await stale.goto(url);
  await stale.locator('[data-music-summary]').click();
  assert.equal(await stale.locator('[data-music-elapsed]').textContent(), '0:00', '失效曲目的进度不能套用到默认曲目');
  assert.equal(await stale.locator('[data-music-volume]').inputValue(), '0.2');
  await staleContext.close();
  checks.push('过期曲目和无效偏好安全回退');
  for (const id of ['moonlight', 'hiraeth', 'dream-culture']) {
    await page.locator(`[data-music-track="${id}"]`).click();
    await page.locator('[data-music-play]').click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('[data-music-audio]');
      return !audio.paused && audio.currentTime > 0 && Number.isFinite(audio.duration) && audio.duration > 60;
    }, null, { timeout: 30000 });
    assert.ok((await audio.getAttribute('src')).includes(`${id}.mp3`));
    if (id === 'moonlight') {
      await audio.evaluate(el => el.pause());
      await page.waitForFunction(() => document.querySelector('[data-music]').dataset.state === 'paused', null, { timeout: 2000 });
      assert.equal(await page.evaluate(() => sessionStorage.getItem('little-universe-music-playing-v1')), 'false', '系统暂停也应取消跨页自动续播');
      await page.locator('[data-music-play]').click();
      await page.waitForFunction(() => !document.querySelector('[data-music-audio]').paused);
    }
    await page.locator('[data-music-play]').click();
    assert.equal(await audio.evaluate(el => el.paused), true);
  }
  checks.push('三首本地 MP3 均实际解码、播放和暂停');
  checks.push('系统媒体暂停同步控件并取消跨页续播');
  await page.locator('[data-music-next]').click();
  assert.equal(await audio.evaluate(el => el.paused), true, '暂停后切歌不应自行播放');
  assert.match(await page.locator('[data-music-title]').innerText(), /Moonlight/);
  await page.locator('[data-music-play]').click();
  await page.waitForFunction(() => !document.querySelector('[data-music-audio]').paused);
  await audio.evaluate(el => { el.dispatchEvent(new Event('ended')); });
  await page.waitForFunction(() => document.querySelector('[data-music-audio]').src.endsWith('hiraeth.mp3'));
  await page.waitForFunction(() => !document.querySelector('[data-music-audio]').paused);
  checks.push('暂停切歌保持暂停、播放结束按歌单循环');
  await page.locator('[data-music-volume]').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  assert.equal(await audio.evaluate(el => el.volume), .35);
  await page.waitForFunction(() => document.querySelector('[data-music-audio]').duration > 0);
  await page.locator('[data-music-seek]').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[data-music-audio]').currentTime >= 25);
  await page.locator('[data-music-play]').click();
  await page.reload();
  await page.locator('[data-music]').waitFor({ state: 'visible' });
  assert.equal(await audio.getAttribute('src'), null, '暂停恢复不应加载音频');
  await page.locator('[data-music-summary]').click();
  assert.match(await page.locator('[data-music-title]').innerText(), /Hiraeth/);
  assert.equal(await page.locator('[data-music-volume]').inputValue(), '0.35');
  await page.locator('[data-music-play]').click();
  await page.waitForFunction(() => document.querySelector('[data-music-audio]').currentTime >= 25);
  await page.goto(`${origin}${base}/archive/`);
  await page.locator('[data-music]').waitFor({ state: 'visible' });
  await page.waitForFunction(() => ['playing', 'paused'].includes(document.querySelector('[data-music]').dataset.state));
  assert.match(await audio.getAttribute('src'), /hiraeth/);
  if (await audio.evaluate(el => el.paused)) {
    assert.match(await page.locator('[data-music-status]').textContent(), /点击播放/);
    await page.locator('[data-music-summary]').click();
    await page.locator('[data-music-play]').click();
    await page.waitForFunction(() => !document.querySelector('[data-music-audio]').paused);
  }
  checks.push('音量进度记忆、暂停刷新不发请求、切页恢复或策略拒绝后手动继续');
  if (await page.locator('[data-music]').getAttribute('open') === null) await page.locator('[data-music-summary]').click();
  await page.locator('[data-music-play]').click();
  await page.evaluate(() => { window.originalAudioPlay = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
  await page.locator('[data-music-play]').click();
  await page.waitForFunction(() => document.querySelector('[data-music-status]').textContent.includes('点击'));
  assert.equal(await audio.evaluate(el => el.paused), true);
  await page.evaluate(() => { HTMLMediaElement.prototype.play = window.originalAudioPlay; });
  await page.locator('[data-music-play]').click();
  await page.waitForFunction(() => !document.querySelector('[data-music-audio]').paused);
  checks.push('播放被拒绝提示且允许重试');
  await page.route('**/audio/dream-culture.mp3', route => route.abort());
  await page.locator('[data-music-track="dream-culture"]').click();
  await page.waitForFunction(() => document.querySelector('[data-music-status]').textContent.includes('无法'));
  await page.locator('[data-music-track="moonlight"]').click();
  await page.locator('[data-music-play]').click();
  await page.waitForFunction(() => !document.querySelector('[data-music-audio]').paused);
  checks.push('音频失败明确提示并可切换恢复');
  await page.waitForFunction(() => document.querySelector('[data-music]').dataset.state === 'playing' && document.querySelector('[data-music-audio]').currentTime > 0);
  await mkdir('.tools/screenshots/music', { recursive: true });
  await page.screenshot({ path: '.tools/screenshots/music/desktop.png', fullPage: true });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-music]').getAttribute('open'), null);
  const mobile = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
  await mobile.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  const phone = await mobile.newPage();
  await phone.goto(url);
  await phone.locator('[data-music-summary]').tap();
  await phone.locator('[data-music-play]').tap();
  await phone.waitForFunction(() => !document.querySelector('[data-music-audio]').paused);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '320px 不应横向溢出');
  const box = await phone.locator('[data-music-panel]').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 320 && box.y >= 0 && box.y + box.height <= 740);
  await phone.screenshot({ path: '.tools/screenshots/music/mobile.png' });
  checks.push('Escape 收起、320px 触屏与禁用存储仍可播放');
  const quietContext = await browser.newContext();
  const quiet = await quietContext.newPage();
  await quiet.goto(`${origin}${base}/`);
  await quiet.locator('[data-entry-skip]').waitFor({ state: 'visible' });
  assert.equal(await quiet.locator('[data-music]').isVisible(), false, '开场期间不应显示或聚焦音乐入口');
  await quiet.locator('[data-entry-skip]').click();
  await quiet.locator('[data-music]').waitFor({ state: 'visible' });
  assert.equal(await quiet.locator('[data-music-audio]').getAttribute('src'), null);
  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await noJsContext.newPage();
  await noJs.goto(url);
  assert.equal(await noJs.locator('[data-music]').isVisible(), false);
  assert.match(await noJs.locator('h1').innerText(), /关于我/);
  checks.push('首页开场隐藏控件、无 JavaScript 时正文正常');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', checks }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
