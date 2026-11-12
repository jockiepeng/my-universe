import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNews, collectNews, recentNews } from '../src/lib/news.mjs';
import { fetchNews } from '../scripts/sync-news.mjs';
import { report, comment } from './fixtures/news.mjs';

test('parses v1.1 paragraphs, links, content basis and historical dates', () => {
 const r = parseNews(report());
 assert.equal(r.date, '2026-11-12'); assert.equal(r.articles.length, 1);
 assert.equal(r.articles[0].summary, '第一段摘要。\n\n第二段摘要。');
 assert.equal(r.articles[0].value, '了解这项变化。');
 assert.equal(r.articles[0].url, 'https://example.org/news?q=1');
 assert.match(r.articles[0].basis, /未读取完整正文/);
 assert.equal(r.history[0].date, '1918-11-12');
});
test('accepts missing history and fewer than target counts without fabricating entries', () => {
 assert.deepEqual(parseNews(report().split('## 历史上的今天')[0]).history, []);
});
test('rejects malformed dates, missing values, reordered fields, sequence gaps and dangerous links', () => {
 for (const input of [report('2026-02-30'), report().replace('**阅读价值：**', '**价值：**'), report().replace('了解这项变化。',''), report().replace('## 1.', '## 2.'), report().replace('https://example.org/news?q=1','javascript:alert(1)'), report().replace('1918-11-12','2026-11-12'), report().replace('1918-11-12','1918-11-11'), '# 2026-11-12 每日新闻']) assert.throws(() => parseNews(input));
});
test('text remains plain data even when it contains HTML', () => {
 assert.equal(parseNews(report('2026-11-12','<img src=x onerror=alert(1)>')).articles[0].title,'<img src=x onerror=alert(1)>');
});
test('collects only owner reports, preserves revision identity and rejects duplicate days', () => {
 const r=collectNews([comment(), comment('2026-11-11'), comment('2026-11-10',{author:{login:'visitor'}}), comment('2026-11-09',{body:'欢迎',author:{login:'visitor'}})], 'jockiepeng');
 assert.deepEqual(r.map(x=>x.date),['2026-11-12','2026-11-11']);
 assert.equal(collectNews([comment('2026-11-12',{body:report('2026-11-12','修订标题')})],'jockiepeng')[0].id,r[0].id);
 assert.throws(()=>collectNews([comment(),comment('2026-11-12',{id:'duplicate'})],'jockiepeng'),/重复/);
 assert.throws(()=>collectNews([comment('2026-11-12',{body:report().replace('**来源：**','**来源错误：**')})],'jockiepeng'));
});
test('recent news uses Beijing calendar days, excludes future, expired and read reports', () => {
 const reports=['2026-11-13','2026-11-12','2026-11-11','2026-11-10','2026-11-09'].map(date=>({id:`9:${date}`,date}));
 assert.deepEqual(recentNews(reports,new Set(),new Date('2026-11-12T15:59:59Z')).map(x=>x.date),['2026-11-12','2026-11-11','2026-11-10']);
 assert.deepEqual(recentNews(reports,new Set(['9:2026-11-12']),new Date('2026-11-12T16:00:00Z')).map(x=>x.date),['2026-11-13','2026-11-11']);
});
test('fetches all top-level pages and ignores replies', async()=>{
 let calls=0;const data=await fetchNews({token:'test-only',repo:'jockiepeng/my-universe',number:'9',owner:'jockiepeng',fetcher:async(_url,options)=>{
  const {variables}=JSON.parse(options.body);assert.equal(variables.cursor,calls===0?null:'next');calls++;
  return {ok:true,json:async()=>({data:{repository:{discussion:{comments:{nodes:[comment(calls===1?'2026-11-12':'2026-11-11')],pageInfo:{hasNextPage:calls===1,endCursor:'next'}}}}}})};
 }});assert.equal(calls,2);assert.equal(data.reports.length,2);
});
test('API errors, incomplete or looping pages fail rather than returning a replacement snapshot',async()=>{
 for(const result of [{errors:[{message:'denied'}]},{data:{}},{data:{repository:{discussion:{comments:{nodes:[],pageInfo:{hasNextPage:true,endCursor:null}}}}}}]){
  await assert.rejects(fetchNews({token:'test-only',repo:'jockiepeng/my-universe',number:9,owner:'jockiepeng',fetcher:async()=>({ok:true,json:async()=>result})}));
 }
 const data=await fetchNews({token:'test-only',repo:'jockiepeng/my-universe',number:9,owner:'jockiepeng',fetcher:async()=>({ok:true,json:async()=>({data:{repository:{discussion:{comments:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}}}})})});
 assert.deepEqual(data.reports,[],'complete empty source reflects deletion');
});
test('malformed owner revisions cannot silently turn into successful deletions',()=>{
 for(const body of ['#2026-11-12 每日新闻','文本被误改',report().replace('每日新闻','每日新问')]) assert.throws(()=>collectNews([comment('2026-11-12',{body})],'jockiepeng'));
});
