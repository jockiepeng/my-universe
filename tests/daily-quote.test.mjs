import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailyQuote } from '../src/lib/daily-quote.mjs';

const quotes = Array.from({ length: 8 }, (_, i) => ({ id: String(i), text: `文案 ${i}`, availableFrom: '2026-01-01' }));

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
  const updated = [{ id: 'new', text: '替换后的内容', availableFrom: '2026-01-01' }];
  assert.equal(getDailyQuote(updated).quote.text, '替换后的内容');
});

test('future additions preserve every earlier daily choice even when the file is reordered', () => {
  const additions = Array.from({ length: 16 }, (_, i) => ({
    id: `new-${i}`, text: `新句子 ${i}`, availableFrom: '2026-11-03',
  }));
  const updated = [...additions, ...quotes.toReversed()];
  for (let day = 0; day < 306; day++) {
    const now = new Date(Date.UTC(2026, 0, day + 1, 4));
    assert.deepEqual(getDailyQuote(updated, now), getDailyQuote(quotes, now));
  }
});

test('a sentence becomes eligible exactly at Shanghai midnight on its start date', () => {
  const scheduled = [{ id: 'scheduled', text: '明天见', availableFrom: '2026-11-03' }];
  assert.equal(getDailyQuote(scheduled, new Date('2026-11-02T15:59:59Z')).quote, null);
  assert.equal(getDailyQuote(scheduled, new Date('2026-11-02T16:00:00Z')).quote.id, 'scheduled');
});

test('new sentences can be selected after their start date', () => {
  const updated = [...quotes, { id: 'new', text: '新句子', availableFrom: '2026-11-03' }];
  const choices = new Set(Array.from({ length: 365 }, (_, day) =>
    getDailyQuote(updated, new Date(Date.UTC(2026, 10, day + 3, 4))).quote.id));
  assert.ok(choices.has('new'));
});

test('missing or invalid start dates and duplicate IDs are rejected before publishing', () => {
  for (const availableFrom of [undefined, '', '2026-2-03', '2026-02-30']) {
    assert.throws(() => getDailyQuote([{ id: 'invalid', text: '句子', availableFrom }]), /availableFrom/);
  }
  assert.throws(() => getDailyQuote([quotes[0], { ...quotes[0], text: '重复编号' }]), /id/);
});
