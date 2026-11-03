import test from 'node:test';
import assert from 'node:assert/strict';
import { publishedPosts, summarize, readingMinutes, categorySlug, formatDateTime } from '../src/lib/content.mjs';

test('Shanghai article timestamps include seconds and use 00 at midnight', () => {
  assert.match(formatDateTime(new Date('2026-11-03T11:17:04+08:00')), /2026.*11.*3.*11:17:04/);
  assert.match(formatDateTime(new Date('2026-11-03T00:00:00+08:00')), /00:00:00/);
});

test('creation timestamps sort to the second and editing old posts never promotes them', () => {
  const entries = [
    { id: 'a-old', data: { date: new Date('2026-11-03T11:00:01+08:00'), updated: new Date('2026-11-04T20:00:00+08:00') } },
    { id: 'z-new', data: { date: new Date('2026-11-03T11:00:02+08:00'), updated: new Date('2026-11-03T11:00:02+08:00') } },
  ];
  assert.deepEqual(publishedPosts(entries).map(entry => entry.id), ['z-new', 'a-old']);
});

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
  assert.equal(categorySlug('技术'), 'technology');
  assert.equal(categorySlug('技术/AI'), 'technology/ai');
  assert.equal(categorySlug('生活'), 'life');
});
