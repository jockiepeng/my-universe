import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readPostUpdated } from '../src/lib/post-times.mjs';

test('historical baseline stays at creation; later edits, reverts and overrides track correctly', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'universe-post-times-'));
  const file = path.join(root, 'post.md');
  const created = new Date('2026-06-07T00:00:00+08:00');
  const source = (body, updated = created.toISOString()) => `---\ndate: ${created.toISOString()}\nupdated: ${updated}\n---\n${body}\n`;
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = time => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-am', 'update'], {
    cwd: root, env: { ...process.env, GIT_AUTHOR_DATE: time, GIT_COMMITTER_DATE: time }, stdio: 'pipe',
  });
  try {
    git(['init']);
    await writeFile(file, source('historical'));
    git(['add', 'post.md']);
    commit('2026-11-03T19:00:00+08:00');
    assert.equal((await readPostUpdated(file, created, created, root)).toISOString(), created.toISOString());
    await writeFile(file, source('edited'));
    await utimes(file, new Date('2026-11-04T09:10:11+08:00'), new Date('2026-11-04T09:10:11+08:00'));
    assert.equal((await readPostUpdated(file, created, created, root)).toISOString(), '2026-11-04T01:10:11.000Z');
    commit('2026-11-04T09:11:12+08:00');
    assert.equal((await readPostUpdated(file, created, created, root)).toISOString(), '2026-11-04T01:11:12.000Z');
    assert.equal((await readPostUpdated(file, created, created, root)).toISOString(), '2026-11-04T01:11:12.000Z', 'rebuild must not use current time');
    await writeFile(file, source('historical'));
    commit('2026-11-05T09:11:12+08:00');
    assert.equal((await readPostUpdated(file, created, created, root)).toISOString(), '2026-11-05T01:11:12.000Z', 'a revert is still a later edit');
    const manual = new Date('2026-11-06T10:20:30+08:00');
    await writeFile(file, source('explicit timestamp', manual.toISOString()));
    commit('2026-11-06T12:00:00+08:00');
    assert.equal((await readPostUpdated(file, created, manual, root)).toISOString(), manual.toISOString());
    const missing = path.join(root, 'missing.md');
    assert.equal((await readPostUpdated(missing, created, undefined, root)).toISOString(), created.toISOString());
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('universe-post-times-'));
    await rm(root, { recursive: true, force: true });
  }
});
