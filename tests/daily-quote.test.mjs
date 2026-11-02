import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailyQuote } from '../src/lib/daily-quote.mjs';

const quotes = Array.from({ length: 8 }, (_, i) => ({ id: String(i), text: `文案 ${i}` }));

test('daily choice is stable within the Shanghai calendar day', () => {
  const morning = getDailyQuote(quotes, new Date('2026-11-01T16:00:00Z'));
  const evening = getDailyQuote(quotes, new Date('2026-11-02T15:59:59Z'));
  assert.deepEqual(morning, evening);
  assert.equal(morning.dateKey, '2026-11-02');
  assert.ok(quotes.some(quote => quote.id === morning.quote.id));
});

test('choice covers the collection over time and changes at Shanghai midnight', () => {
  const choices = new Set();
  for (let day = 0; day < 365; day++) {
    const result = getDailyQuote(quotes, new Date(Date.UTC(2026, 0, day + 1, 4)));
    choices.add(result.quote.id);
  }
  assert.equal(choices.size, quotes.length);
  assert.notEqual(getDailyQuote(quotes, new Date('2026-11-02T15:59:59Z')).dateKey, getDailyQuote(quotes, new Date('2026-11-02T16:00:00Z')).dateKey);
});

test('empty or one-entry collections and replacement data remain valid', () => {
  assert.equal(getDailyQuote([]).quote, null);
  assert.deepEqual(getDailyQuote([quotes[0]]).quote, quotes[0]);
  const updated = [{ id: 'new', text: '替换后的内容' }];
  assert.equal(getDailyQuote(updated).quote.text, '替换后的内容');
});
