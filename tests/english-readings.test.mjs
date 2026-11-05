import test from 'node:test';
import assert from 'node:assert/strict';
import corpus from '../src/data/fortune-texts.json' with { type: 'json' };
import english from '../src/data/fortune-texts.en.json' with { type: 'json' };
import quotes from '../src/data/daily-quotes.json' with { type: 'json' };
import { fortuneReading } from '../src/lib/fortune.mjs';
import { getDailyQuote } from '../src/lib/daily-quote.mjs';
import { englishQuoteAttribution, englishQuotePool } from '../src/i18n/readings.mjs';

test('all 196 lots have individually written English poems and reflections', () => {
  const interpretations = new Set();
  const grades = { '上签': 'Favorable', '中签': 'Balanced', '下签': 'Challenging' };
  for (const [collection, records] of Object.entries(corpus)) {
    assert.equal(english[collection].length, records.length);
    for (const record of records) {
      const reading = english[collection][record.number - 1];
      assert.equal(reading.number, record.number, `${collection} number ordering`);
      assert.equal(reading.grade, grades[record.grade]);
      assert.equal(reading.poem.length, 4, `${collection} ${record.number}`);
      for (const text of [reading.grade, ...reading.poem, reading.interpretation]) {
        assert.equal(typeof text, 'string');
        assert.ok(text.trim().length > 5);
        assert.doesNotMatch(text, /\p{Script=Han}|TODO|placeholder|translation pending/iu);
      }
      assert.ok(reading.interpretation.length > 80);
      assert.equal(fortuneReading(collection, reading.number).sourceUrl, record.sourceUrl);
      interpretations.add(reading.interpretation);
    }
  }
  assert.equal(interpretations.size, 196);
});

test('English daily quotes preserve existing passages, IDs, dates and evidence', () => {
  const pool = englishQuotePool(quotes);
  const eligible = quotes.filter(quote => quote.originalLanguage === 'en');
  assert.ok(pool.length > 100);
  assert.equal(pool.length, eligible.length);
  for (const quote of pool) {
    const original = quotes.find(item => item.id === quote.id);
    assert.equal(quote.text, original.original);
    assert.equal(quote.sourceUrl, original.sourceUrl);
    assert.equal(quote.availableFrom, original.availableFrom);
    assert.equal(quote.evidenceSource, original.evidenceSource);
    assert.doesNotMatch(`${quote.text} ${quote.author} ${quote.source}`, /\p{Script=Han}/u);
  }
});

test('English attributions distinguish authors and preserve book, section and line references', () => {
  assert.deepEqual(englishQuoteAttribution({ author: '弗朗西斯·培根', source: '《培根随笔》《论友谊》' }), {
    author: 'Francis Bacon', source: '“Essays”, “Of Friendship”',
  });
  assert.equal(englishQuoteAttribution({ author: '拉尔夫·沃尔多·爱默生', source: '《爱默生随笔》《论友谊》' }).source, '“Essays”, “Friendship”');
  assert.equal(englishQuoteAttribution({ author: '威廉·莎士比亚', source: '《十四行诗》第 18 首，第 1—2 行' }).source, '“Sonnets”, poem 18, lines 1–2');
  assert.equal(englishQuoteAttribution({ author: '米歇尔·德·蒙田', source: '《蒙田随笔全集》第一卷《论隐居》（本版第 38 章）' }).source, '“The Complete Essays”, book I, “Of Solitude” (chapter 38 in this edition)');
  assert.equal(englishQuoteAttribution({ author: '巴鲁赫·斯宾诺莎', source: '《伦理学》第五部分，命题 42 附释末句' }).source, '“Ethics”, part V, proposition 42, final sentence of the scholium');
});

test('English selections stay deterministic across language switches and Shanghai midnight', () => {
  const pool = englishQuotePool(quotes);
  const morning = new Date('2026-11-04T16:00:00Z');
  const evening = new Date('2026-11-05T15:59:59Z');
  const beforeSwitch = getDailyQuote(pool, morning);
  getDailyQuote(quotes, morning);
  assert.deepEqual(getDailyQuote(pool, evening), beforeSwitch);
  assert.deepEqual(getDailyQuote(pool.toReversed(), morning), beforeSwitch);
  assert.equal(getDailyQuote(pool, new Date('2026-11-05T16:00:00Z')).dateKey, '2026-11-06');
});
