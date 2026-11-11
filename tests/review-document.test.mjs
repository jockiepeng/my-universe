import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReview } from '../scripts/lib/review-document.mjs';
test('final document leads with review coverage and attention before evidence', () => {
  const report = { snapshot: 'abc', parents: ['def'], reviewer: 'Reviewer', featureChanges: false, concerns: ['Local hooks can be bypassed.'], redLines: [], checks: Object.fromEntries(['privacy', 'changelog', 'content', 'bugs'].map(key => [key, { status: 'pass', evidence: 'Detailed evidence here.' }])), verification: { status: 'pass', command: 'npm run verify' } };
  const md = renderReview(report);
  assert.ok(md.indexOf('审查点') < md.indexOf('具体 Review 内容'));
  assert.ok(md.indexOf('重点关注') < md.indexOf('具体 Review 内容'));
  assert.match(md, /Local hooks can be bypassed/); assert.match(md, /Detailed evidence/);
});
