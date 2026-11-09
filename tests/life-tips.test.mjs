import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTips } from '../src/lib/life-tips.mjs';

test('searches titles and body case-insensitively and preserves order', () => {
  const tips = [{id:'1', body:'# 设置 App\n选择 English'}, {id:'2', body:'# 生活窍门'}];
  assert.deepEqual(filterTips(tips, ' english ').map(x => x.id), ['1']);
  assert.deepEqual(filterTips(tips, '').map(x => x.id), ['1', '2']);
});
