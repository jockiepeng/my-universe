import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, formatPlan } from '../src/lib/plans.mjs';

test('round trips custom categories, multiline content and optional date', () => {
  const value = { type:'旅行', title:'出行计划', content:'查路线\n订车票', date:'2027-01-01', status:'进行中' };
  assert.deepEqual(parsePlan(formatPlan(value)), value);
});
test('ignores unrelated and malformed comments', () => {
  assert.equal(parsePlan('普通评论'), null);
  assert.equal(parsePlan('## 规划\n类型：文章\n名称：标题\n状态：未知\n内容：\n正文'), null);
});

test('accepts a plan with empty optional content and date', () => {
  const value = { type:'文章', title:'草稿', content:'', date:'', status:'待开始' };
  assert.deepEqual(parsePlan(formatPlan(value)), value);
});
