import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailyMotion, resolveMotion } from '../src/lib/motion.mjs';

test('same Shanghai date tail gives a stable combination, independent of month', () => {
  const a = getDailyMotion(new Date('2026-11-02T12:00:00+08:00'));
  const b = getDailyMotion(new Date('2027-01-12T00:00:00+08:00'));
  assert.deepEqual([a.scene, a.opening, a.tail], [b.scene, b.opening, 2]);
  assert.equal(a.dateKey, '2026-11-02');
});
test('all three backgrounds and both openings occur across the ten date tails', () => {
  const combinations = new Set();
  for (let day = 1; day <= 10; day++) {
    const result = getDailyMotion(new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00+08:00`));
    combinations.add(`${result.scene}:${result.opening}`);
  }
  assert.equal(combinations.size, 6);
});
test('Shanghai midnight refreshes tail and expires yesterday manual selection', () => {
  const manual = { scene: 'ocean', opening: 'portal', selectionDate: '2026-11-02' };
  assert.equal(resolveMotion(manual, new Date('2026-11-02T15:59:59Z')).scene, 'ocean');
  const next = resolveMotion(manual, new Date('2026-11-02T16:00:00Z'));
  const daily = getDailyMotion(new Date('2026-11-02T16:00:00Z'));
  assert.equal(next.dateKey, '2026-11-03');
  assert.equal(next.sceneMode, 'daily');
  assert.deepEqual([next.scene, next.opening], [daily.scene, daily.opening]);
});
test('manual scene and opening can be selected separately and reset to daily', () => {
  const now = new Date('2026-11-02T12:00:00+08:00');
  const daily = getDailyMotion(now);
  const manual = resolveMotion({ scene: 'aurora', opening: 'daily', selectionDate: daily.dateKey }, now);
  assert.equal(manual.scene, 'aurora'); assert.equal(manual.opening, daily.opening);
  assert.equal(manual.sceneMode, 'manual'); assert.equal(manual.openingMode, 'daily');
  assert.equal(resolveMotion({}, now).sceneMode, 'daily');
});
