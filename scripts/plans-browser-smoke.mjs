import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('dist');
const server = createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname).replace(/^\/my-universe\//, '/');
  const file = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const ext = path.extname(file); res.writeHead(200, {'Content-Type': ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'}[ext] || 'application/octet-stream')}).end(await readFile(file)); } catch { res.writeHead(404).end(); }
});
let executable = process.env.BROWSER_PATH;
if (!executable) for (const candidate of ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','/usr/bin/chromium']) { try { await access(candidate); executable=candidate; break; } catch {} }
assert.ok(executable, 'Chrome is required');
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({executablePath:executable,headless:true});
try {
  const page = await browser.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } }, configurable: true }); });
  await page.goto(`${origin}/my-universe/plans/`);
  await page.locator('[name=title]').fill('测试规划');
  await page.locator('[data-plan-form] button').click();
  assert.equal(await page.locator('.moments-discussion').evaluate(el => el.open), true, 'copy opens the posting area');
  assert.equal(await page.locator('[data-plan-preview]:visible').count(), 0, 'successful copy does not show a misleading editable box');
  assert.match(await page.evaluate(() => window.__copied), /名称：测试规划/);
  const fallbackPage = await browser.newPage();
  await fallbackPage.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true }); });
  await fallbackPage.goto(`${origin}/my-universe/plans/`);
  await fallbackPage.locator('[name=title]').fill('手动复制');
  await fallbackPage.locator('[data-plan-form] button').click();
  assert.equal(await fallbackPage.locator('.moments-discussion').evaluate(el => el.open), true, 'fallback still opens the posting area');
  assert.match(await fallbackPage.locator('[data-plan-preview]').inputValue(), /名称：手动复制/);
  assert.match(await fallbackPage.locator('[data-copy-status]').textContent(), /无法自动复制/);
  console.log('Planning compose flow passed');
} finally { await browser.close(); server.close(); }
