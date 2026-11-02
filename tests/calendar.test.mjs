import test from 'node:test';
import assert from 'node:assert/strict';
import { getZonedClock, getMonthCalendar, shiftMonth } from '../src/lib/calendar.mjs';

test('month navigation crosses years and supports multiple jumps', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2027, 1, -1), { year: 2026, month: 12 });
  assert.deepEqual(shiftMonth(2026, 11, 15), { year: 2028, month: 2 });
});

test('Shanghai midnight updates the date and uses 00 rather than 24', () => {
  const before = getZonedClock(new Date('2026-11-02T15:59:59Z'));
  const after = getZonedClock(new Date('2026-11-02T16:00:00Z'));
  assert.equal(before.dateKey, '2026-11-02');
  assert.equal(before.time, '23:59:59');
  assert.equal(after.dateKey, '2026-11-03');
  assert.equal(after.time, '00:00:00');
  assert.equal(after.weekday, '星期二');
});

test('Shanghai clock changes month and year at the local year boundary', () => {
  const result = getZonedClock(new Date('2026-12-31T16:00:01Z'));
  assert.deepEqual([result.year, result.month, result.day, result.dateKey, result.time], [2027, 1, 1, '2027-01-01', '00:00:01']);
});

test('a month beginning on Sunday leaves six Monday-first slots empty', () => {
  const month = getMonthCalendar(2026, 11, '2026-11-02');
  assert.equal(month.weeks.length, 6);
  assert.deepEqual(month.weeks[0].map(cell => cell.day), [null, null, null, null, null, null, 1]);
  assert.equal(month.weeks[1][0].dateKey, '2026-11-02');
  assert.equal(month.weeks[1][0].today, true);
  assert.equal(month.weeks.flat().filter(cell => cell.today).length, 1);
});

test('February contains 29 days only in a leap year', () => {
  const leap = getMonthCalendar(2024, 2, '2024-02-29');
  const ordinary = getMonthCalendar(2025, 2, '2025-02-28');
  assert.equal(leap.weeks.flat().filter(cell => cell.day !== null).length, 29);
  assert.equal(ordinary.weeks.flat().filter(cell => cell.day !== null).length, 28);
  assert.equal(leap.weeks.flat().find(cell => cell.today).day, 29);
});

test('a month beginning on Monday starts at the first slot', () => {
  const month = getMonthCalendar(2021, 2, '2021-02-01');
  assert.deepEqual(month.weeks[0].map(cell => cell.day), [1, 2, 3, 4, 5, 6, 7]);
});
