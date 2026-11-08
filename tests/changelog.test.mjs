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
