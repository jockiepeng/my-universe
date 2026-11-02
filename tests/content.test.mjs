import test from 'node:test';
import assert from 'node:assert/strict';
import { publishedPosts, summarize, readingMinutes, categorySlug } from '../src/lib/content.mjs';

test('production excludes drafts and sorts newest first without changing input', () => {
  const entries = [
    { id: 'old', data: { date: new Date('2026-01-01'), draft: false } },
    { id: 'private', data: { date: new Date('2026-11-02'), draft: true } },
    { id: 'new', data: { date: new Date('2026-10-01'), draft: false } },
  ];
  assert.deepEqual(publishedPosts(entries).map(e => e.id), ['new', 'old']);
  assert.deepEqual(publishedPosts(entries, true).map(e => e.id), ['private', 'new', 'old']);
  assert.equal(entries[0].id, 'old');
});

test('summary removes markup and link targets while retaining Chinese text', () => {
  const summary = summarize('# 想法\n\n**记录** [日常](https://example.com) ![照片](/image.png)\n```js\nsecretCode()\n```');
  assert.match(summary, /想法.*记录.*日常/);
  assert.doesNotMatch(summary, /https|secretCode|image.png|\*\*/);
  assert.equal(summarize('生活'.repeat(100), 12).length, 13);
});

test('reading time counts Chinese characters and English words separately', () => {
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('文'.repeat(601)), 3);
  assert.equal(readingMinutes('word '.repeat(401)), 3);
});

test('category URLs remain stable when displayed in Chinese', () => {
  assert.equal(categorySlug('日常'), 'daily');
  assert.equal(categorySlug('随想'), 'thoughts');
  assert.equal(categorySlug('实践'), 'practice');
});
