import { chromium } from 'playwright-core';
import { cp, symlink, mkdtemp, readFile, writeFile, mkdir, rm, access, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { report, comment } from '../tests/fixtures/news.mjs';
import { collectNews, newsReadKey } from '../src/lib/news.mjs';

const temp = await realpath(await mkdtemp(path.join(tmpdir(), 'my-universe-news-smoke-')));
let browser, server;
try {
  // Build a disposable fixture project; never replace the real news snapshot.
  for (const file of ['src', 'public', 'astro.config.mjs', 'package.json']) await cp(file, path.join(temp, file), { recursive: true });
  await symlink(path.resolve('node_modules'), path.join(temp, 'node_modules'), 'dir');
  const comments = ['2026-11-12','2026-11-11','2026-11-10','2026-11-09'].map(d => comment(d));
  comments[0].body = report('2026-11-12','<img src=x onerror=alert(1)> 测试新闻');
  comments[2].body = report('2026-11-10').split('## 历史上的今天')[0];
  await writeFile(path.join(temp,'src/data/news.json'),JSON.stringify({updatedAt:'2026-11-12T00:45:00Z',reports:collectNews(comments,'jockiepeng')}));
  await writeFile(path.join(temp,'src/data/plans.json'),JSON.stringify({updatedAt:null,moments:[]}));
  execFileSync(process.execPath,[path.resolve('node_modules/astro/bin/astro.mjs'),'build','--root',temp],{cwd:temp,stdio:'pipe',encoding:'utf8',env:{...process.env,BASE_PATH:'/my-universe'}});
  let empty = false;
  server=createServer(async(req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const root=empty?path.resolve('dist'):path.join(temp,'dist');
    const file=path.resolve(root,pathname.replace(/^\/my-universe\//,''),pathname.endsWith('/')?'index.html':'');
    if(!pathname.startsWith('/my-universe/')||!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
    try { const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'})[ext]||'application/octet-stream'}).end(await readFile(file)); }
    catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`,base=origin+'/my-universe';
  let executable=process.env.BROWSER_PATH;
  for(const c of ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium']){
    if(executable)break;try{await access(c);executable=c;}catch{}
  }
  assert.ok(executable,'Set BROWSER_PATH to Chrome or Chromium');
  browser=await chromium.launch({executablePath:executable,headless:true});
  const context=await browser.newContext({viewport:{width:1360,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-12T04:00:00Z'));
  await page.goto(base+'/plans/');
  const root=page.locator('[data-home-notifications]');
  await page.waitForFunction(()=>!document.querySelector('.avatar-dot').hidden);
  await root.locator('summary').click();await page.locator('[data-notification-open]').click();
  assert.equal(await page.locator('[data-news-notification-list] li').count(),3);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),newsReadKey),null,'opening notifications does not mark news read');
  await page.locator('[data-news-notification-list] a').first().click();
  await page.waitForURL(base+'/news/2026-11-12/');
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'[]').length===1,newsReadKey);
  assert.equal(await page.locator('.news-card').count(),1);
  assert.match(await page.locator('.news-card h3').innerText(),/<img src=x/);
  assert.equal(await page.locator('.news-card img').count(),0,'news titles are escaped');
  assert.equal(await page.locator('.news-event').count(),1);
  assert.equal(await page.locator('.u-nav a[aria-current="page"]').innerText(),'每日新闻');
  await root.locator('summary').click();await page.locator('[data-notification-open]').click();
  assert.equal(await page.locator('[data-news-notification-list] li').count(),2,'only visited day is read');
  await page.keyboard.press('Escape');
  await page.locator('[data-language-toggle]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await page.locator('.u-nav a[aria-current="page"]').innerText(),'Daily news');
  assert.equal(await page.locator('.news-value h4').innerText(),'Why it matters');
  assert.match(await page.locator('.news-summary').innerText(),/第一段摘要/,'news prose remains original');
  await mkdir('.tools/screenshots',{recursive:true});
  await page.screenshot({path:'.tools/screenshots/news-desktop.png'});
  await page.locator('[data-language-toggle]').click();
  await page.setViewportSize({width:375,height:900});
  await page.waitForTimeout(300);
  await page.screenshot({path:'.tools/screenshots/news-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no mobile overflow');
  await page.goto(base+'/news/2026-11-10/');
  assert.match(await page.locator('.news-history').innerText(),/本期暂无历史事件/);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),newsReadKey),['9:2026-11-12','9:2026-11-10']);
  // The second tab shares read state and storage events update its dot without reload.
  const other=await context.newPage();await other.clock.setFixedTime(new Date('2026-11-12T04:00:00Z'));
  await other.goto(base+'/plans/');
  await other.waitForFunction(()=>!document.querySelector('.avatar-dot').hidden);
  await page.goto(base+'/news/2026-11-11/');
  await other.waitForFunction(()=>document.querySelector('.avatar-dot').hidden);
  await other.clock.setFixedTime(new Date('2026-11-12T16:00:00Z'));
  await other.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await other.locator('.avatar-dot').isVisible(),false,'old read dates do not reappear at midnight');
  const denied=await browser.newPage();await denied.clock.setFixedTime(new Date('2026-11-12T04:00:00Z'));
  await denied.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked');};Storage.prototype.setItem=()=>{throw Error('blocked');};});
  await denied.goto(base+'/news/2026-11-12/');
  await denied.locator('[data-home-notifications] summary').click();await denied.locator('[data-notification-open]').click();
  assert.equal(await denied.locator('[data-news-notification-list] li').count(),2,'storage failure retains current visit read status');
  assert.deepEqual(errors,[]);
  empty=true;await page.goto(base+'/news/');
  assert.equal(await page.locator('.news-empty').isVisible(),true,'empty production snapshot is honest');
  assert.equal(await page.locator('.avatar-dot').isVisible(),false);
  assert.match(await page.locator('[data-news-status]').innerText(),/尚无已同步日报/);
  await page.evaluate(()=>{document.querySelector('[data-news-status]').dataset.syncFailed='true';document.dispatchEvent(new Event('visibilitychange'));});
  assert.match(await page.locator('[data-news-status]').innerText(),/同步暂时失败/);
  console.log('PASS news: navigation, dated history, safe text, notification click/read, 3-day window, cross-tab sync, blocked storage, English, mobile and empty state.');
} finally {
  await browser?.close();if(server)await new Promise(r=>server.close(r));
  await rm(temp,{recursive:true,force:true});
}
