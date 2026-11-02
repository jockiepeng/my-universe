import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';
import { getDailyMotion } from '../src/lib/motion.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const dist = path.resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(dist, pathname.slice(base.length).replace(/^\/+/, ''), pathname.endsWith('/') ? 'index.html' : '');
    if (!pathname.startsWith(`${base}/`) || !file.startsWith(`${dist}${path.sep}`)) throw new Error('Path outside site');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}${base}/`;
let executable = process.env.BROWSER_PATH;
for (const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']) {
  if (executable) break;
  try { await access(candidate); executable = candidate; } catch { /* Try next browser. */ }
}
const browser = await chromium.launch({ executablePath: executable, headless: true, args: ['--enable-unsafe-swiftshader'] });
const screenshots = '.tools/screenshots/scene-consistency';
await mkdir(screenshots, { recursive: true });
try {
  for (const fallback of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
    await context.addInitScript(({ fallback }) => {
      if (!fallback) return;
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type === 'webgl' ? null : getContext.call(this, type, ...args);
      };
    }, { fallback });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${url}archive/`);
      for (const scene of ['galaxy', 'aurora', 'ocean']) {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(preferences => localStorage.setItem('little-universe-appearance-v1', JSON.stringify(preferences)), {
            scene, theme, motion: false, selectionDate: getDailyMotion().dateKey,
          });
          let homePalette, homeBackdrop;
          for (const route of ['', 'archive/', 'games/']) {
            await page.goto(`${url}${route}#scene-review`);
            assert.equal(await page.locator('[data-home-scene]').count(), 1, `${route || 'home'} must have the shared scene`);
            await page.waitForFunction(() => document.querySelector('[data-home-scene]').dataset.renderer);
            assert.equal(await page.locator('[data-home-scene]').getAttribute('data-renderer'), fallback ? 'fallback' : 'webgl');
            assert.equal(await page.locator('[data-home-scene]').getAttribute('data-state'), 'paused');
            const palette = await page.evaluate(() => {
              const style = selector => getComputedStyle(document.querySelector(selector));
              return {
                text: style('body').color,
                header: style('.u-header-shell').backgroundColor,
                footer: style('.u-footer-shell').backgroundColor,
                border: style('.u-header-shell').borderBottomColor,
                backdrop: style('.u-home-scene').backgroundImage,
                shade: style('.u-scene-shade').backgroundImage,
                panel: style(document.body.dataset.home === undefined ? '#main-content' : '.u-main-grid').backgroundColor,
              };
            });
            const backdrop = await page.screenshot({ clip: { x: 1320, y: 260, width: 20, height: 150 } });
            if (!route) { homePalette = palette; homeBackdrop = backdrop; }
            else {
              assert.deepEqual(palette, homePalette, `${scene} ${theme} ${route}: shared page colors`);
              if (!backdrop.equals(homeBackdrop)) {
                const difference = await page.evaluate(async images => {
                  const pixels = await Promise.all(images.map(source => new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = image.width; canvas.height = image.height;
                      const pen = canvas.getContext('2d');
                      pen.drawImage(image, 0, 0);
                      resolve(pen.getImageData(0, 0, canvas.width, canvas.height).data);
                    };
                    image.onerror = reject; image.src = source;
                  })));
                  let maximum = 0, total = 0, changed = 0;
                  for (let i = 0; i < pixels[0].length; i++) {
                    const delta = Math.abs(pixels[0][i] - pixels[1][i]);
                    maximum = Math.max(maximum, delta); total += delta; if (delta) changed++;
                  }
                  return { maximum, mean: total / pixels[0].length, changed };
                }, [backdrop, homeBackdrop].map(buffer => `data:image/png;base64,${buffer.toString('base64')}`));
                // Composited CSS gradients may dither a few channels by 1–2/255.
                assert.ok(difference.maximum <= 2 && difference.mean < .01,
                  `${scene} ${theme} ${route}: same static scene colors (${JSON.stringify(difference)})`);
              }
            }
            if (!fallback) await page.screenshot({ path: `${screenshots}/${scene}-${theme}-${route.replace('/', '') || 'home'}.png` });
          }
          console.log(`PASS: ${scene} ${theme} shared colors and ${fallback ? 'CSS fallback' : 'static scene'}`);
        }
      }
      if (!fallback) {
        await page.evaluate(() => {
          const key = 'little-universe-appearance-v1';
          localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), motion: true }));
        });
        for (const route of ['archive/', 'games/', 'about/', 'posts/knowledge-base-practice/', 'games/snake/']) {
          await page.goto(`${url}${route}`);
          await page.waitForFunction(() => document.querySelector('[data-home-scene]')?.dataset.renderer);
          assert.equal(await page.locator('[data-home-scene]').getAttribute('data-state'), 'paused', `${route}: inner page scene stays static with motion enabled`);
        }
        await page.goto(`${url}#scene-review`);
        await page.waitForFunction(() => document.querySelector('[data-home-scene]').dataset.state === 'running');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => document.querySelector('[data-home-scene]').dataset.state === 'paused');
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 844 });
          for (const route of ['', 'archive/', 'games/']) {
            await page.goto(`${url}${route}#scene-review`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px ${route}: no horizontal overflow`);
            await page.screenshot({ path: `${screenshots}/mobile-${width}-${route.replace('/', '') || 'home'}.png` });
          }
        }
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
} finally { await browser.close(); server.close(); }
