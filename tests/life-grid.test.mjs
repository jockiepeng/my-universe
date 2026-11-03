import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLife, cellDetails, formatDay } from '../src/lib/life-grid.mjs';

test('公历日包含闰日，今天不计为已走过', () => {
  const life = calculateLife('2000-01-01', 1, '2000-01-08');
  assert.equal(life.totalDays, 366);
  assert.equal(life.elapsedDays, 7);
  assert.equal(life.remainingDays, 359);
  assert.equal(life.totalWeeks, 53);
  assert.equal(life.elapsedWeeks, 1);
  assert.equal(life.remainingWeeks, 52);
  assert.equal(formatDay(life.endDay), '2001-01-01');
});

test('闰日出生的非闰年寿命终点取二月二十八日', () => {
  const life = calculateLife('2000-02-29', 1, '2001-02-27');
  assert.equal(formatDay(life.endDay), '2001-02-28');
  assert.equal(life.totalDays, 365);
  assert.equal(life.remainingDays, 1);
});

test('出生当天当前格为第一天，周从出生日期连续计数', () => {
  const life = calculateLife('2026-11-03', 80, '2026-11-03');
  assert.equal(life.elapsedDays, 0);
  assert.deepEqual(cellDetails(life, 'day', 0), { start: '2026-11-03', end: '2026-11-03', status: 'current', days: 1 });
  assert.deepEqual(cellDetails(life, 'week', 0), { start: '2026-11-03', end: '2026-11-09', status: 'current', days: 7 });
});

test('完整周与当前周有区别，切换后每天的进度不变', () => {
  const life = calculateLife('2000-01-01', 80, '2000-01-10');
  assert.equal(life.elapsedDays, 9);
  assert.equal(life.elapsedWeeks, 1);
  assert.equal(cellDetails(life, 'week', 0).status, 'past');
  assert.equal(cellDetails(life, 'week', 1).status, 'current');
  assert.equal(cellDetails(life, 'week', 2).status, 'future');
  assert.equal(cellDetails(life, 'day', 8).status, 'past');
  assert.equal(cellDetails(life, 'day', 9).status, 'current');
  assert.equal(life.elapsedDays + life.remainingDays, life.totalDays);
  assert.equal(life.elapsedWeeks + life.remainingWeeks, life.totalWeeks);
});

test('最后不足七天的周截断到终点前一天，超期后全部完成', () => {
  const life = calculateLife('2001-01-01', 1, '2001-12-31');
  assert.deepEqual(cellDetails(life, 'week', 52), { start: '2001-12-31', end: '2001-12-31', status: 'current', days: 1 });
  for (const today of ['2002-01-01', '2026-11-03']) {
    const ended = calculateLife('2001-01-01', 1, today);
    assert.equal(ended.remainingDays, 0);
    assert.equal(ended.remainingWeeks, 0);
    assert.equal(ended.elapsedWeeks, 53);
    assert.equal(cellDetails(ended, 'week', 52).status, 'past');
  }
});

test('夏令时边界按日期计算，不受一天小时数影响', () => {
  const life = calculateLife('2024-03-09', 1, '2024-03-11');
  assert.equal(life.elapsedDays, 2);
  assert.equal(formatDay(life.birthDay + 1), '2024-03-10');
});

test('拒绝非法日期、未来出生、非法寿命与越界格子', () => {
  for (const birth of ['2025-02-29', '2000-13-01', '2000-00-10', '2000-01-32', '', '1/2/2000', '0000-01-01', '2026-11-04']) {
    assert.throws(() => calculateLife(birth, 80, '2026-11-03'));
  }
  for (const years of [0, 121, 80.5, NaN, Infinity, '80']) assert.throws(() => calculateLife('2000-01-01', years, '2026-11-03'));
  const life = calculateLife('2000-01-01', 80, '2026-11-03');
  for (const index of [-1, life.totalDays, 0.5, NaN]) assert.throws(() => cellDetails(life, 'day', index));
  assert.throws(() => cellDetails(life, 'month', 0));
});
