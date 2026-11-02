import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountdown, countdownTargets } from '../src/lib/countdown.mjs';

test('2027 countdown uses midnight in Shanghai rather than UTC', () => {
  const result = getCountdown('2027-01-01T00:00:00+08:00', new Date('2026-12-30T16:00:00Z'));
  assert.deepEqual(result, { days: 1, hours: 0, minutes: 0, seconds: 0, reached: false });
});

test('the remaining fractional second stays positive until the event starts', () => {
  const result = getCountdown('2027-01-01T00:00:00+08:00', new Date('2026-12-31T15:59:59.500Z'));
  assert.deepEqual(result, { days: 0, hours: 0, minutes: 0, seconds: 1, reached: false });
});

test('a reached target stays at zero and does not roll into another year', () => {
  for (const now of ['2026-12-31T16:00:00Z', '2027-02-01T00:00:00Z']) {
    assert.deepEqual(getCountdown('2027-01-01T00:00:00+08:00', new Date(now)), { days: 0, hours: 0, minutes: 0, seconds: 0, reached: true });
  }
});

test('the lunar new year target begins on February 6 in Shanghai', () => {
  const lunar = countdownTargets.find(target => target.id === 'spring-2027');
  const before = getCountdown(lunar.target, new Date('2027-02-05T15:59:59Z'));
  const after = getCountdown(lunar.target, new Date('2027-02-05T16:00:00Z'));
  assert.equal(before.reached, false);
  assert.equal(before.seconds, 1);
  assert.equal(after.reached, true);
});
