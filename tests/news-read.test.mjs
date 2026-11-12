import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNewsRead, markNewsRead } from '../src/lib/news-read.mjs';
import { newsReadKey } from '../src/lib/news.mjs';
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('reading a report persists only its day and preserves other read days',()=>{
 const storage=store();markNewsRead('9:2026-11-12',storage);markNewsRead('9:2026-11-11',storage);
 assert.deepEqual([...loadNewsRead(storage)],['9:2026-11-12','9:2026-11-11']);
 assert.ok(storage.getItem(newsReadKey));
});
test('corrupt or externally cleared storage does not invent read days',()=>{
 const storage=store();storage.setItem(newsReadKey,'{');assert.equal(loadNewsRead(storage).size,0);
 storage.setItem(newsReadKey,'[null,12,"9:2026-11-12"]');assert.deepEqual([...loadNewsRead(storage)],['9:2026-11-12']);
 storage.setItem(newsReadKey,'[]');assert.equal(loadNewsRead(storage).size,0);
});
test('blocked storage still remembers the report during the visit',()=>{
 const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 markNewsRead('9:2026-11-10',storage);assert.equal(loadNewsRead(storage).has('9:2026-11-10'),true);
});
