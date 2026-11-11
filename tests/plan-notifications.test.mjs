import test from 'node:test';
import assert from 'node:assert/strict';
import { overduePlans } from '../src/lib/plan-notifications.mjs';
import { formatPlan } from '../src/lib/plans.mjs';
const moment = (date, status = '待开始', url = 'https://github.com/example#1') => ({ url, body: formatPlan({type:'文章', title:'测试计划', content:'', date, status}) });
test('uses Beijing midnight, excludes today and completed plans', () => {
  const items = [moment('2026-11-10'), moment('2026-11-11', '进行中', 'https://github.com/example#2'), moment('2026-11-09', '已完成')];
  assert.equal(overduePlans(items, new Date('2026-11-11T15:59:59Z')).length, 1);
  const result = overduePlans(items, new Date('2026-11-11T16:00:00Z'));
  assert.equal(result.length, 2);
  assert.equal(result[0].days, 2);
});
test('ignores invalid, missing and future dates and unrelated comments', () => {
  assert.deepEqual(overduePlans(['', '2026-02-30', '2026-13-01', 'tomorrow', '2027-01-01'].map(d => moment(d)).concat({body:'hello'}), new Date('2026-11-11T00:00:00Z')), []);
});
test('read identity survives status changes but changes for a new deadline', () => {
  const now = new Date('2026-11-11T00:00:00Z');
  const id = overduePlans([moment('2026-11-09')], now)[0].id;
  assert.equal(overduePlans([moment('2026-11-09','进行中')], now)[0].id, id);
  assert.notEqual(overduePlans([moment('2026-11-10')], now)[0].id, id);
});
