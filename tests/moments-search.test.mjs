import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMomentIndex, filterMomentIndex } from '../src/lib/moments-search.mjs';

test('searches text and replies, dates in Shanghai, then sorts', () => {
  const index = buildMomentIndex([{id:'a',body:'Hello 世界',createdAt:'2026-01-01T16:30:00Z',replies:[{bodyHTML:'<p>星空 &amp; 海</p>'}]},{id:'b',body:'HELLO',createdAt:'2026-01-01T15:30:00Z',replies:[]}]);
  assert.deepEqual(filterMomentIndex(index,{query:'hello',from:'2026-01-02',to:'2026-01-02'}).map(x=>x.id),['a']);
  assert.deepEqual(filterMomentIndex(index,{query:'星空'}).map(x=>x.id),['a']);
  assert.deepEqual(filterMomentIndex(index,{query:'hello',order:'oldest'}).map(x=>x.id),['b','a']);
});

test('filters and pages a ten-thousand-moment index', () => {
  const moments = Array.from({length:10000}, (_, i) => ({id:String(i), body:i % 100 === 0 ? '旅行记录' : '日常', createdAt:new Date(Date.UTC(2025,0,1) + i * 60000).toISOString()})).reverse();
  const index = buildMomentIndex(moments);
  const found = filterMomentIndex(index,{query:'旅行'});
  assert.equal(found.length, 100);
  assert.equal(found[0].id, '9900');
  assert.equal(found.at(-1).id, '0');
  assert.ok(new TextEncoder().encode(JSON.stringify(index)).length < 2_000_000);
});
