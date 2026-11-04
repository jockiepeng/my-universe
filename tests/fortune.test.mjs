import test from 'node:test';
import assert from 'node:assert/strict';
import { chineseNumber, sourceUrl, drawFortune, restoreHistory, addHistory } from '../src/lib/fortune.mjs';
import * as fortune from '../src/lib/fortune.mjs';

const now = new Date('2026-11-04T04:00:00Z');
const first = { collection: 'guanyin', number: 1, drawnAt: now.toISOString() };

test('source links match the displayed edition and boundary sign', () => {
  assert.equal(sourceUrl('guanyin', 100), 'https://www.zhouyi.cc/lingqian/guanyin/5483.html');
  assert.equal(sourceUrl('chekung', 96), 'https://www.zhouyi.cc/lingqian/chegong/7314.html');
  for (const [id, number] of [['chekung', 97], ['guanyin', 0], ['guanyin', 1.5], ['unknown', 1]]) {
    assert.throws(() => sourceUrl(id, number), RangeError);
  }
});

test('a reading resolves the actual poem for its collection, including the final sign', () => {
  assert.deepEqual(fortune.fortuneReading?.('guanyin', 1)?.poem, [
    '开天辟地作良缘', '吉日良时万物全', '若得此签非小可', '人行忠正帝王宣',
  ]);
  assert.deepEqual(fortune.fortuneReading('chekung', 96).poem, [
    '山水相逢淘沙金', '性坚何误小人言', '只管秉心行正道', '举头三尺有神前',
  ]);
  assert.notDeepEqual(fortune.fortuneReading('guanyin', 1).poem, fortune.fortuneReading('chekung', 1).poem);
});

test('every drawable number has a complete local reading and provenance, without placeholders', () => {
  assert.equal(typeof fortune.fortuneReading, 'function');
  const readings = [];
  for (const [id, count, segment] of [['guanyin', 100, 'guanyin'], ['chekung', 96, 'chegong']]) {
    for (let number = 1; number <= count; number++) {
      const reading = fortune.fortuneReading(id, number);
      assert.equal(reading.number, number);
      assert.equal(reading.poem.length, 4, `${id} ${number}`);
      assert.ok(reading.poem.every(line => /^[\p{Script=Han}]{5,9}$/u.test(line)), `${id} ${number}: ${reading.poem}`);
      assert.ok(['上上签', '上签', '中签', '下签', '下下签', '满签'].includes(reading.grade));
      assert.ok(reading.interpretation.length >= 25, `${id} ${number} needs its own interpretation`);
      assert.doesNotMatch(reading.interpretation, /待补|占位|暂无|<|>/);
      assert.match(reading.sourceUrl, new RegExp(`^https://www\\.zhouyi\\.cc/lingqian/${segment}/\\d+\\.html$`));
      assert.equal(sourceUrl(id, number), reading.sourceUrl);
      readings.push(reading);
    }
  }
  assert.equal(new Set(readings.map(reading => reading.interpretation)).size, 196, 'interpretations are specific to each sign');
});

test('readings cannot be corrupted by callers or resolved from invalid numbers', () => {
  assert.equal(typeof fortune.fortuneReading, 'function');
  for (const [id, number] of [['guanyin', 0], ['guanyin', 101], ['chekung', 97], ['guanyin', '1'], ['guanyin', NaN], ['__proto__', 1]]) {
    assert.throws(() => fortune.fortuneReading(id, number), RangeError);
  }
  const reading = fortune.fortuneReading('guanyin', 1);
  assert.throws(() => { reading.poem[0] = '伪造签文'; }, TypeError);
  assert.throws(() => { reading.interpretation = '伪造解读'; }, TypeError);
});

test('sign numbering handles ten, compound tens and one hundred', () => {
  for (const [n, expected] of [[1, '一'], [10, '十'], [11, '十一'], [20, '二十'], [96, '九十六'], [100, '一百']]) {
    assert.equal(chineseNumber(n), expected);
  }
  for (const n of [0, 101, NaN, 1.5]) assert.throws(() => chineseNumber(n), RangeError);
});

test('each collection can draw its first and final signs, with no zero', () => {
  assert.deepEqual(drawFortune('guanyin', () => 0, now), first);
  assert.equal(drawFortune('guanyin', () => 99, now).number, 100);
  assert.equal(drawFortune('chekung', () => 95, now).number, 96);
  for (let word = 0; word < 100; word++) assert.equal(drawFortune('guanyin', () => word, now).number, word + 1);
  assert.throws(() => drawFortune('unknown', () => 0, now), RangeError);
});

test('rejection sampling drops the uneven uint32 tail instead of biasing low signs', () => {
  const values = [4294967295, 4294967200, 99];
  assert.equal(drawFortune('guanyin', () => values.shift(), now).number, 100);
  assert.equal(values.length, 0);
  assert.throws(() => drawFortune('guanyin', () => -1, now), RangeError);
});

test('restoring corrupted or untrusted history never creates invalid signs or carries markup', () => {
  for (const raw of ['', '{', 'null', '[]', '{"version":2,"entries":[]}']) assert.deepEqual(restoreHistory(raw), []);
  const entries = [null, first, { ...first, collection: '__proto__' }, { ...first, number: 101 },
    { ...first, drawnAt: 'yesterday' }, { ...first, number: '1' },
    { ...first, collection: 'chekung', number: 97 },
    { ...first, number: 7, source: 'javascript:alert(1)', poem: '<script>' }];
  assert.deepEqual(restoreHistory(JSON.stringify({ version: 1, entries })), [first, { ...first, number: 7 }]);
});

test('new draws are stored latest first and bounded without mutating earlier history', () => {
  const old = Array.from({ length: 20 }, (_, i) => ({ ...first, number: i + 1 }));
  const record = { ...first, collection: 'chekung', number: 96 };
  const next = addHistory(old, record);
  assert.equal(next.length, 20);
  assert.deepEqual(next[0], record);
  assert.equal(next[19].number, 19);
  assert.equal(old[0].number, 1);
  assert.deepEqual(restoreHistory(JSON.stringify({ version: 1, entries: next })), next);
});
