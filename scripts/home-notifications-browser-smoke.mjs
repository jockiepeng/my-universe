import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { formatPlan } from '../src/lib/plans.mjs';
const fixtures = [{url:'https://github.com/example#1', body:formatPlan({type:'文章', title:'过期计划', date:'2026-11-10', status:'进行中', content:''})}, {url:'https://github.com/example#2', body:formatPlan({type:'文章', title:'明日变过期', date:'2026-11-11', status:'待开始', content:''})}];
let inject = true;
const root = path.resolve('dist');
const server = createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname).replace(/^\/my-universe\//, '/');
  const file = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try { const ext = path.extname(file); res.writeHead(200, {'Content-Type': ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'}[ext] || 'application/octet-stream')}).end(inject && ext === '.html' ? (await readFile(file, 'utf8')).replace(/data-plans="[^"]*"/, `data-plans="${JSON.stringify(fixtures).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')}"`) : await readFile(file)); } catch { res.writeHead(404).end(); }
});

await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let executable = process.env.BROWSER_PATH;
if (!executable) for (const candidate of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']) {
  try { await access(candidate); executable = candidate; break; } catch { /* Try next installed browser. */ }
}
if (!executable) { server.close(); throw new Error('Set BROWSER_PATH to Chrome or Chromium.'); }
const browser = await chromium.launch({executablePath:executable,headless:true});
try {
  const page = await browser.newPage();
  await page.clock.setFixedTime(new Date('2026-11-11T04:00:00Z'));
  await page.goto(`${origin}/my-universe/`);
  await page.locator('[data-entry-skip]').click({force:true});
  await page.waitForTimeout(600);
  const root = page.locator('[data-home-notifications]');
  const dot = page.locator('.avatar-dot');
  await root.waitFor({state:'visible'});
  assert.equal(await dot.isVisible(), true);
  await root.locator('summary').click();
  assert.equal(await dot.isVisible(), true, 'opening avatar does not mark notifications read');
  assert.equal(await root.locator('.profile-dropdown [data-notification-dot]').isVisible(), true);
  await root.locator('[data-notification-open]').click();
  await page.waitForFunction(() => document.querySelector('.avatar-dot').hidden);
  assert.match(await root.textContent(), /过期计划/);
  assert.equal(await root.locator('li').count(), 1);
  await root.locator('[data-notification-close]').click();
  await page.reload();
  assert.equal(await dot.isVisible(), false, 'read survives reload');
  await page.clock.setFixedTime(new Date('2026-11-12T04:00:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await dot.isVisible(), true, 'new overdue item is unread');
  await page.setViewportSize({width:390,height:844});
  await root.locator('summary').click();
  assert.ok(await root.locator('.profile-dropdown').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), 'mobile avatar menu stays in viewport');
  await root.locator('[data-notification-open]').click();
  assert.equal(await root.locator('li').count(),2);
  assert.ok(await root.locator('dialog').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
  await page.screenshot({path:'/tmp/my-universe-home-notifications-mobile.png',fullPage:false});
  const denied = await browser.newPage();
  await denied.clock.setFixedTime(new Date('2026-11-11T04:00:00Z'));
  await denied.addInitScript(() => { Storage.prototype.getItem = () => {throw Error('blocked')}; Storage.prototype.setItem = () => {throw Error('blocked')}; });
  await denied.goto(`${origin}/my-universe/`);
  await denied.locator('[data-entry-skip]').click({force:true});
  await denied.waitForTimeout(600);
  await denied.locator('[data-home-notifications] summary').click();
  await denied.locator('[data-notification-open]').click();
  await denied.waitForFunction(() => document.querySelector('.avatar-dot').hidden);
  await denied.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await denied.locator('.avatar-dot').isVisible(),false);
  await page.keyboard.press('Escape');
  assert.equal(await root.locator('dialog').evaluate(el => el.open), false, 'Escape closes notification dialog');
  await page.goto(`${origin}/my-universe/plans/`);
  await root.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await root.locator('[data-profile-menu]').evaluate(el => el.open), true, 'keyboard opens avatar menu on planning page');
  await root.locator('[data-notification-open]').click();
  assert.equal(await root.locator('dialog').evaluate(el => el.open), true, 'notifications work outside homepage');
  await page.keyboard.press('Escape');
  inject = false;
  await page.goto(`${origin}/my-universe/`);
  await page.locator('[data-entry-skip]').click({force:true});
  await page.waitForTimeout(600);
  assert.equal(await root.isVisible(),true,'avatar remains available with no notifications');
  assert.equal(await dot.isVisible(),false);
  await root.locator('summary').click();
  await root.locator('[data-notification-open]').click();
  assert.equal(await root.locator('[data-notification-empty]').isVisible(),true);
  console.log('Homepage notifications: unread, read, reload, new deadlines, mobile, storage failure and empty state passed');
} finally { await browser.close(); server.close(); }
