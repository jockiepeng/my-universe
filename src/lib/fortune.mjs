import corpus from '../data/fortune-texts.json' with { type: 'json' };

export const collections = Object.freeze([
  Object.freeze({ id: 'guanyin', name: '观音签', traditionalName: '觀音籤', count: 100 }),
  Object.freeze({ id: 'chekung', name: '车公签', traditionalName: '車公籤', count: 96 }),
]);

export const fortuneStorageKey = 'little-universe-fortunes-v1';

const readings = Object.freeze(Object.fromEntries(Object.entries(corpus).map(([id, entries]) => [
  id, Object.freeze(entries.map(entry => Object.freeze({ ...entry, poem: Object.freeze([...entry.poem]) }))),
])));

function collectionFor(id) {
  const collection = collections.find(item => item.id === id);
  if (!collection) throw new RangeError('Unknown fortune collection');
  return collection;
}

function validNumber(collection, number) {
  if (!Number.isInteger(number) || number < 1 || number > collection.count) throw new RangeError('Invalid sign number');
}

export function chineseNumber(number) {
  if (!Number.isInteger(number) || number < 1 || number > 100) throw new RangeError('Invalid Chinese sign number');
  const digits = '零一二三四五六七八九';
  if (number === 100) return '一百';
  if (number < 10) return digits[number];
  return `${number >= 20 ? digits[Math.floor(number / 10)] : ''}十${number % 10 ? digits[number % 10] : ''}`;
}

export function sourceUrl(id, number) {
  return fortuneReading(id, number).sourceUrl;
}

export function fortuneReading(id, number) {
  const collection = collectionFor(id);
  validNumber(collection, number);
  const reading = readings[id][number - 1];
  if (!reading || reading.number !== number) throw new RangeError('Missing fortune reading');
  return reading;
}

function randomWord() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

export function drawFortune(id, random32 = randomWord, now = new Date()) {
  const collection = collectionFor(id);
  const limit = Math.floor(2 ** 32 / collection.count) * collection.count;
  let word;
  do {
    word = random32();
    if (!Number.isInteger(word) || word < 0 || word >= 2 ** 32) throw new RangeError('Invalid random word');
  } while (word >= limit);
  return { collection: id, number: word % collection.count + 1, drawnAt: now.toISOString() };
}

function cleanRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const collection = collections.find(item => item.id === record.collection);
  if (!collection || !Number.isInteger(record.number) || record.number < 1 || record.number > collection.count) return null;
  if (typeof record.drawnAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.drawnAt) || !Number.isFinite(Date.parse(record.drawnAt))) return null;
  return { collection: collection.id, number: record.number, drawnAt: new Date(record.drawnAt).toISOString() };
}

export function restoreHistory(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.entries)) return [];
    return saved.entries.map(cleanRecord).filter(Boolean).slice(0, 20);
  } catch { return []; }
}

export function addHistory(history, record) {
  const clean = cleanRecord(record);
  if (!clean) throw new RangeError('Invalid fortune record');
  return [clean, ...history.map(cleanRecord).filter(Boolean)].slice(0, 20);
}
