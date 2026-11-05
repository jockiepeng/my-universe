import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, normalizeLanguage } from '../src/lib/i18n.mjs';

test('only supported preferences are accepted', () => {
  assert.equal(normalizeLanguage('en'), 'en');
  for (const value of [null, undefined, '', 'fr', {}, 'zh']) assert.equal(normalizeLanguage(value), 'zh');
});

test('translates complete UI messages and retains surrounding whitespace', () => {
  assert.equal(translate(' 首页 ', 'en'), ' Home ');
  assert.equal(translate('显示 12 篇', 'en'), '12 posts');
  assert.equal(translate('切换背景，当前为星系漫游', 'en'), 'Change background, current: Galaxy');
  assert.equal(translate('首页', 'zh'), '首页');
});

test('unknown prose is never partially rewritten', () => {
  const prose = '首页是故事的起点，我喜欢技术，也喜欢生活。';
  assert.equal(translate(prose, 'en'), prose);
  assert.equal(translate('unrecognized text', 'en'), 'unrecognized text');
  assert.equal(translate('', 'en'), '');
});

test('nested messages keep dates, counts and category labels in English', () => {
  assert.equal(translate('2026年11月5日 09:04:02'), '2026-11-5 09:04:02');
  assert.equal(translate('# AI 编程'), '# AI coding');
  assert.equal(translate('技术 / 数据库'), 'Technology / Databases');
  assert.equal(translate('jockie的小宇宙 · 慢慢写，慢慢生长。'), "jockie's universe · Write slowly, grow gently.");
});
