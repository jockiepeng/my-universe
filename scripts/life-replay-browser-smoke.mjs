import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base=normalizeBase(process.env.BASE_PATH??'/my-universe'), dist=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try { const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); const file=path.resolve(dist,pathname.slice(base.length).replace(/^\/+/,''),pathname.endsWith('/')?'index.html':'');
    if((base&&!pathname.startsWith(base+'/'))||!file.startsWith(dist+path.sep))throw new Error('path');
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(await readFile(file));
  }catch{res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`, url=`${origin}${base}/tools/life-replay/`;
let executable=process.env.BROWSER_PATH;
for(const candidate of ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium']) { if(executable)break;try{await access(candidate);executable=candidate;}catch{} }
let browser;const errors=[], root='[data-life-replay-page]';
const number=value=>Number(value.replaceAll(',','').trim());
async function ready(page){await page.waitForSelector(`${root}[data-ready="true"]`);}
async function submit(page,birth='1990-04-15',years='85'){await page.locator('[name="birth"]').fill(birth);await page.locator('[name="lifespan"]').fill(years);await page.locator('[data-life-submit]').click();}
async function counts(page,week=false){assert.equal(number(await page.locator('[data-life-total]').textContent()),week?4436:31046);assert.equal(number(await page.locator('[data-life-elapsed]').textContent()),13351);assert.equal(number(await page.locator('[data-life-remaining]').textContent()),17695);assert.equal(await page.locator('[data-life-percent]').textContent(),'43.0%');}
async function savePoster(page,name){await page.locator('[data-life-share-open]').click();await page.waitForSelector('[data-life-share-dialog][data-ready="true"]');const download=page.waitForEvent('download');await page.locator('[data-life-download]').click();await(await download).saveAs(`.tools/screenshots/${name}.png`);assert.equal(await page.locator('[data-life-poster]').evaluate(el=>el.naturalWidth),1600);}
try{
  browser=await chromium.launch({executablePath:executable,headless:true});await mkdir('.tools/screenshots',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Asia/Shanghai',reducedMotion:'no-preference'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-11-03T04:00:00Z'));
  await page.goto(`${origin}${base}/tools/`);
  assert.equal(await page.getByRole('link',{name:/角色旅程/}).count(),1);assert.equal(await page.getByRole('link',{name:/时光回放/}).count(),1);
  await page.screenshot({path:'.tools/screenshots/life-two-versions.png',fullPage:true});
  await page.getByRole('link',{name:/时光回放/}).click();await ready(page);
  assert.equal(await page.locator('[name="birth"]').inputValue(),'');assert.equal(await page.locator(root).getAttribute('data-animating'),'false','示例不自动播放');
  assert.equal(await page.locator('[data-character]').count(),0,'新版独立页面不含旧版角色');
  await submit(page);assert.equal(await page.locator(root).getAttribute('data-animating'),'true');
  await page.waitForTimeout(1200);const during=Number(await page.locator(root).getAttribute('data-shown-days'));assert.ok(during>0&&during<13351);
  await page.locator('[data-life-pause]').click();const paused=await page.locator(root).getAttribute('data-shown-days');await page.waitForTimeout(350);assert.equal(await page.locator(root).getAttribute('data-shown-days'),paused);
  await page.locator('[data-life-result]').screenshot({path:'.tools/screenshots/life-light-replaying.png'});
  await page.locator('[data-life-pause]').click();await page.waitForSelector(`${root}[data-animating="false"]`,{timeout:15000});
  assert.equal(await page.locator(root).getAttribute('data-shown-days'),'13351');assert.match(await page.locator('[data-life-story-copy]').textContent(),/刚刚这几秒/);await counts(page);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'.tools/screenshots/life-light-desktop.png',fullPage:true});
  const lastScene=Number(await page.locator(root).getAttribute('data-scene-count'))-1;assert.equal(lastScene,6,'36岁展示出生、童年、少年、青春、成年、三十和今天');
  await page.locator('[data-replay-prev]').click();assert.equal(await page.locator(root).getAttribute('data-scene-index'),String(lastScene-1));assert.match(await page.locator('[data-life-story-title]').textContent(),/三十而立/);assert.ok(Number(await page.locator(root).getAttribute('data-shown-days'))<13351);
  for(let i=lastScene-1;i>0;i--)await page.locator('[data-replay-prev]').click();assert.equal(await page.locator(root).getAttribute('data-shown-days'),'0');assert.equal(await page.locator('[data-replay-prev]').isDisabled(),true);
  await page.locator('[data-replay-next]').click();assert.equal(await page.locator(root).getAttribute('data-scene-index'),'1');assert.match(await page.locator('[data-life-story-title]').textContent(),/童年/);
  await submit(page);assert.equal(await page.locator(root).getAttribute('data-animating'),'false','第二次提交不强制重播');
  await page.locator('[data-life-replay]').click();assert.equal(await page.locator(root).getAttribute('data-animating'),'true');await page.locator('[data-life-skip]').click();
  await page.locator('[data-life-unit="week"]').click();await counts(page,true);await page.locator('.lr-details summary').click();
  await page.locator('[data-life-query]').fill('4436');await page.locator('[data-life-query-form] button[type="submit"]').click();assert.match(await page.locator('[data-life-detail]').textContent(),/2075-04-14/);
  await page.locator('[data-life-canvas]').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.match(await page.locator('[data-life-detail]').textContent(),/1990-04-22/);
  await page.locator('[data-life-wish]').fill('想和在意的人，一起去看更大的世界。');await savePoster(page,'life-light-week-poster');
  assert.match(await page.locator('[data-life-poster]').getAttribute('alt'),/一生不过 31,046 天。珍惜时间，热爱生活/);
  assert.doesNotMatch(await page.locator('[data-life-poster-summary]').textContent(),/1990-04-15/);
  await page.locator('[data-life-include-birth]').check();await page.waitForFunction(()=>document.querySelector('[data-life-share-dialog]').dataset.ready==='true'&&document.querySelector('[data-life-poster-summary]').textContent.includes('1990-04-15'));
  await page.locator('[data-life-share-close]').click();await page.locator('[data-life-unit="day"]').click();await counts(page);await savePoster(page,'life-light-day-poster');
  const pixel=await page.locator('[data-life-poster]').evaluate(el=>{const c=document.createElement('canvas');c.width=1600;c.height=2400;const ctx=c.getContext('2d');ctx.drawImage(el,0,0);return [...ctx.getImageData(0,0,1,1).data];});assert.deepEqual(pixel,[16,20,23,255]);
  await page.locator('[data-life-share-close]').click();await submit(page,'2000-01-01','1');assert.equal(await page.locator(root).getAttribute('data-animating'),'false');assert.match(await page.locator('[data-replay-age]').textContent(),/2000-12-31/);assert.equal(number(await page.locator('[data-life-remaining]').textContent()),0);
  await submit(page,'2026-11-03','80');await page.locator('[data-life-replay]').click();assert.equal(await page.locator(root).getAttribute('data-animating'),'false');assert.equal(await page.locator(root).getAttribute('data-shown-days'),'0');
  await context.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',timezoneId:'Asia/Shanghai'});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.clock.install({time:new Date('2026-11-03T04:00:00Z')});await phone.goto(url);await ready(phone);await submit(phone);await counts(phone);
  assert.equal(await phone.locator(root).getAttribute('data-animating'),'false');
  for(const width of [390,320]){await phone.setViewportSize({width,height:844});assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await phone.screenshot({path:`.tools/screenshots/life-light-mobile-${width}.png`,fullPage:true});}
  await phone.locator('[data-life-fullscreen-open]').click();
  for(const viewport of [{width:320,height:844},{width:844,height:390}]){await phone.setViewportSize(viewport);await phone.locator('[data-life-fullscreen-query]').fill('31046');await phone.locator('[data-life-fullscreen-query-form] button[type="submit"]').click();assert.match(await phone.locator('[data-life-fullscreen-detail]').textContent(),/2075-04-14/);assert.equal(await phone.locator('[data-life-fullscreen-plot]').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1),true);await phone.screenshot({path:`.tools/screenshots/life-light-full-${viewport.width}.png`});}
  await phone.locator('[data-life-fs-unit="week"]').click();await counts(phone,true);await phone.locator('[data-life-fullscreen-close]').click();assert.equal(await phone.locator('[data-life-fullscreen-open]').evaluate(el=>document.activeElement===el),true);
  await submit(phone,'2026-11-03','80');await phone.clock.fastForward(86400000);assert.equal(number(await phone.locator('[data-life-elapsed]').textContent()),1,'跨天更新');
  assert.deepEqual(await phone.evaluate(()=>Object.keys(localStorage).filter(k=>/life|birth/i.test(k))),[]);assert.equal(new URL(phone.url()).search,'');await mobile.close();

  const sharingContext=await browser.newContext({reducedMotion:'reduce'});await sharingContext.addInitScript(()=>{Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(navigator,'share',{value:async()=>{throw new DOMException('cancel','AbortError');},configurable:true});});
  const sharing=await sharingContext.newPage();sharing.on('pageerror',e=>errors.push(e.message));await sharing.goto(url);await ready(sharing);await sharing.locator('[data-life-wish]').fill('👨‍👩‍👧‍👦'.repeat(85));assert.equal(await sharing.locator('[data-life-wish-count]').textContent(),'80 / 80');await savePoster(sharing,'life-light-emoji-poster');await sharing.locator('[data-life-native-share]').click();assert.match(await sharing.locator('[data-life-share-status]').textContent(),/取消/);await sharingContext.close();
  const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();await staticPage.goto(url);assert.equal(await staticPage.locator('[data-life-submit]').isDisabled(),true);await nojs.close();
  assert.deepEqual(errors,[]);console.log('PASS: 两版本独立入口、按年龄的多幕首播与前后幕/暂停/恢复/结束/重播、日周精确统计、极端日期、真实总天数及珍惜生活海报、手机全屏无拖动、跨天、分享取消、80字emoji、无JS');
}finally{await browser?.close();server.close();}
