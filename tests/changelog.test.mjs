import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('change history is dated, categorized and traceable to commits', async () => {
  const entries = JSON.parse(await readFile(new URL('../src/data/changelog.json', import.meta.url), 'utf8'));
  assert.ok(entries.length > 10);
  for (const [index, entry] of entries.entries()) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['added', 'removed', 'improved', 'fixed'].includes(entry.type));
    assert.ok(entry.text && entry.en);
    if (entry.commit !== undefined) assert.match(entry.commit, /^[a-f0-9]{7,40}$/);
    if (index) assert.ok(entries[index - 1].date >= entry.date);
  }
});

test('today’s entries include bilingual detail and technical explanations', async () => {
  const entries = JSON.parse(await readFile(new URL('../src/data/changelog.json', import.meta.url), 'utf8'));
  const today = entries.filter(entry => entry.date === '2026-11-09');
  assert.ok(today.length >= 3);
  for (const entry of today) {
    assert.ok(Array.isArray(entry.details) && entry.details.length >= 2, entry.text);
    for (const section of entry.details) assert.ok(section.title && section.enTitle && section.text && section.en, entry.text);
    assert.ok(entry.details.some(section => section.title === '技术原理'), entry.text);
    if (entry.type === 'fixed' || entry.type === 'improved') {
      for (const title of ['原来的情况', '处理方式', '更新后的效果']) assert.ok(entry.details.some(section => section.title === title), `${entry.text}: ${title}`);
    }
  }
});
