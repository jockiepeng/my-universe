import { newsReadKey } from './news.mjs';
let memory = new Set();
export function loadNewsRead(storage) {
  let raw;
  try { raw = (storage ?? globalThis.localStorage).getItem(newsReadKey) || '[]'; }
  catch { return new Set(memory); }
  try {
    const data = JSON.parse(raw);
    memory = new Set(Array.isArray(data) ? data.filter(id => typeof id === 'string' && /^\d+:\d{4}-\d{2}-\d{2}$/.test(id)) : []);
  } catch { memory = new Set(); }
  return new Set(memory);
}
export function markNewsRead(id, storage) {
  const read = loadNewsRead(storage);
  read.add(id);
  memory = new Set([...read].slice(-2000));
  try { (storage ?? globalThis.localStorage).setItem(newsReadKey, JSON.stringify([...memory])); } catch { /* In-memory fallback. */ }
}
