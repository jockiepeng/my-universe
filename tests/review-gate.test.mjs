import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
const cli = path.resolve('scripts/review-gate.mjs');
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'review-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  writeFileSync(path.join(dir, 'file.txt'), 'base'); git('add', '.'); git('commit', '-qm', 'base');
  writeFileSync(path.join(dir, 'file.txt'), 'change'); git('add', '.');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' });
  return { dir, git, run };
}
function report(f) {
  assert.equal(f.run('init', 'docs/reviews/test.json').status, 0);
  const p = path.join(f.dir, 'docs/reviews/test.json');
  const r = JSON.parse(readFileSync(p));
  r.reviewer = 'test reviewer'; r.featureChanges = false;
  for (const c of Object.values(r.checks)) { c.status = 'pass'; c.evidence = 'Reviewed the complete diff and confirmed expected behavior.'; }
  r.verification = { status: 'pass', command: 'npm run verify', snapshot: r.snapshot };
  writeFileSync(p, JSON.stringify(r)); f.run('render', path.relative(f.dir, p)); f.git('add', '.');
  return { p, r, save() { writeFileSync(p, JSON.stringify(r)); f.run('render', path.relative(f.dir, p)); f.git('add', '.'); } };
}
test('missing report blocks commit', t => {
  const f = fixture(t); const result = f.run('commit');
  assert.notEqual(result.status, 0); assert.match(result.stderr, /报告/);
});
test('matching report passes; changed code invalidates it', t => {
  const f = fixture(t); report(f); assert.equal(f.run('commit').status, 0);
  writeFileSync(path.join(f.dir, 'file.txt'), 'later'); f.git('add', '.');
  assert.notEqual(f.run('commit').status, 0);
});
test('red lines and missing evidence block', t => {
  const f = fixture(t); const r = report(f);
  r.r.redLines = ['unresolved bug']; r.save(); assert.notEqual(f.run('commit').status, 0);
  r.r.redLines = []; r.r.checks.privacy.evidence = ''; r.save(); assert.notEqual(f.run('commit').status, 0);
});
test('new changelog entries must include type-specific bilingual sections', t => {
  const f = fixture(t); mkdirSync(path.join(f.dir, 'src/data'), { recursive: true });
  writeFileSync(path.join(f.dir, 'src/data/changelog.json'), JSON.stringify([{ date: '2026-11-11', type: 'fixed', text: '修复', en: 'Fix' }]));
  f.git('add', '.'); const r = report(f); r.r.featureChanges = true; r.save();
  assert.notEqual(f.run('commit').status, 0);
});
test('push checks every outgoing commit and permits deletions', t => {
  const f = fixture(t); report(f); const parent = f.git('rev-parse', 'HEAD'); f.git('commit', '-qm', 'reviewed');
  const sha = f.git('rev-parse', 'HEAD');
  const push = input => spawnSync(process.execPath, [cli, 'push'], { cwd: f.dir, input, encoding: 'utf8' });
  assert.equal(push(`refs/heads/main ${sha} refs/heads/main ${parent}\n`).status, 0);
  writeFileSync(path.join(f.dir, 'file.txt'), 'unreviewed'); f.git('add', '.'); f.git('commit', '-qm', 'unchecked');
  assert.notEqual(push(`refs/heads/main ${f.git('rev-parse', 'HEAD')} refs/heads/main ${parent}\n`).status, 0);
  assert.equal(push(`(delete) ${'0'.repeat(40)} refs/heads/main ${sha}\n`).status, 0);
});
test('valid bilingual new feature details pass; missing usage blocks', t => {
  const f = fixture(t); mkdirSync(path.join(f.dir, 'src/data'), { recursive: true });
  const file = path.join(f.dir, 'src/data/changelog.json');
  const entry = { date: '2026-11-11', type: 'added', text: '新增可使用的新功能入口。', en: 'Added a usable feature entry.', details: ['功能内容', '使用方式', '技术原理'].map(title => ({ title, enTitle: 'Section', text: '具体说明真实的功能及实现方式。', en: 'Concrete explanation of the actual behavior.' })) };
  writeFileSync(file, JSON.stringify([entry])); f.git('add', '.'); report(f);
  assert.equal(f.run('commit').status, 0);
  entry.details.splice(1, 1); writeFileSync(file, JSON.stringify([entry])); f.git('add', '.');
  f.run('init', 'docs/reviews/second.json');
  const p = path.join(f.dir, 'docs/reviews/second.json');
  const r = JSON.parse(readFileSync(p)); r.reviewer = 'test reviewer'; r.featureChanges = true;
  for (const c of Object.values(r.checks)) { c.status = 'pass'; c.evidence = 'Inspected actual changes against the requirements.'; }
  r.verification = { status: 'pass', command: 'npm run verify', snapshot: r.snapshot };
  writeFileSync(p, JSON.stringify(r)); f.run('render', path.relative(f.dir, p)); f.git('add', '.'); assert.notEqual(f.run('commit').status, 0);
});
test('verification refuses unstaged source changes and invalidates old success', t => {
  const f = fixture(t); const { p } = report(f);
  writeFileSync(path.join(f.dir, 'file.txt'), 'unstaged');
  assert.notEqual(f.run('verify', 'docs/reviews/test.json').status, 0);
  assert.match(f.run('verify', 'docs/reviews/test.json').stderr, /暂存/);
  assert.equal(JSON.parse(readFileSync(p)).verification.status, 'pending');
});
test('scanner blocks a newly added credential without echoing it', t => {
  const f = fixture(t); const secret = 'gh' + 'p_' + 'a'.repeat(36);
  writeFileSync(path.join(f.dir, 'file.txt'), secret); f.git('add', '.'); report(f);
  const result = f.run('commit'); assert.notEqual(result.status, 0); assert.ok(!result.stderr.includes(secret));
});
test('reusing a report after amending a different parent is rejected', t => {
  const f = fixture(t); report(f); f.git('commit', '-qm', 'reviewed');
  assert.notEqual(f.run('commit').status, 0);
});
test('a credential accidentally copied into review evidence is also blocked', t => {
  const f = fixture(t); const r = report(f); r.r.checks.privacy.evidence = 'gh' + 'p_' + 'b'.repeat(36); r.save();
  assert.notEqual(f.run('commit').status, 0);
});
test('missing or manually edited Markdown final report blocks commit', t => {
  const f = fixture(t); report(f);
  writeFileSync(path.join(f.dir, 'docs/reviews/test.md'), 'manually changed'); f.git('add', '.');
  assert.notEqual(f.run('commit').status, 0);
});

test('installed hook blocks a real git commit without a report and allows a reviewed one', t => {
  const f = fixture(t);
  cpSync(path.resolve('.githooks'), path.join(f.dir, '.githooks'), { recursive: true });
  cpSync(path.resolve('scripts'), path.join(f.dir, 'scripts'), { recursive: true });
  const installed = spawnSync(process.execPath, [path.resolve('scripts/install-review-hooks.mjs')], { cwd: f.dir, encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stderr);
  f.git('add', '.');
  const blocked = spawnSync('git', ['commit', '-qm', 'should block'], { cwd: f.dir, encoding: 'utf8' });
  assert.notEqual(blocked.status, 0);
  report(f); assert.doesNotThrow(() => f.git('commit', '-qm', 'reviewed'));
});
test('installer preserves an existing hooks configuration', t => {
  const f = fixture(t); f.git('config', 'core.hooksPath', 'existing-hooks');
  const installed = spawnSync(process.execPath, [path.resolve('scripts/install-review-hooks.mjs')], { cwd: f.dir, encoding: 'utf8' });
  assert.notEqual(installed.status, 0); assert.equal(f.git('config', '--get', 'core.hooksPath'), 'existing-hooks');
});
test('amend mode binds the actual amended parents and remains pushable', t => {
  const f = fixture(t);
  cpSync(path.resolve('.githooks'), path.join(f.dir, '.githooks'), { recursive: true });
  cpSync(path.resolve('scripts'), path.join(f.dir, 'scripts'), { recursive: true });
  assert.equal(spawnSync(process.execPath, [path.resolve('scripts/install-review-hooks.mjs')], { cwd: f.dir }).status, 0);
  f.git('add', '.'); report(f); f.git('commit', '-qm', 'first');
  const parent = f.git('rev-parse', 'HEAD^');
  writeFileSync(path.join(f.dir, 'file.txt'), 'amended'); f.git('add', '.');
  assert.equal(f.run('init', 'docs/reviews/amended.json', '--amend').status, 0);
  const p = path.join(f.dir, 'docs/reviews/amended.json'); const r = JSON.parse(readFileSync(p));
  assert.deepEqual(r.parents, [parent]);
  r.reviewer = 'Reviewer'; r.featureChanges = false;
  for (const c of Object.values(r.checks)) { c.status = 'pass'; c.evidence = 'Reviewed the amended content and actual parent changes.'; }
  r.verification = { status: 'pass', command: 'npm run verify', snapshot: r.snapshot };
  writeFileSync(p, JSON.stringify(r)); f.run('render', 'docs/reviews/amended.json'); f.git('add', '.');
  assert.equal(f.run('amend', '--no-edit').status, 0);
  const sha = f.git('rev-parse', 'HEAD');
  const pushed = spawnSync(process.execPath, [cli, 'push'], { cwd: f.dir, input: `refs/heads/main ${sha} refs/heads/main ${parent}\n`, encoding: 'utf8' });
  assert.equal(pushed.status, 0, pushed.stderr);
});
