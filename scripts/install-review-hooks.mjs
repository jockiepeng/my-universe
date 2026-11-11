import { execFileSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
try {
  let existing = '';
  try { existing = git('config', '--get', 'core.hooksPath'); } catch { /* unset */ }
  if (existing && existing !== '.githooks') throw new Error(`已有 hooksPath=${existing}，请先人工整合，未覆盖。`);
  for (const name of ['pre-commit', 'pre-push']) chmodSync(`.githooks/${name}`, 0o755);
  git('config', '--local', 'review.nodePath', process.execPath);
  git('config', '--local', 'core.hooksPath', '.githooks');
  console.log('Review hooks 已安装；本地 Git 使用当前 Node 路径。');
} catch (e) { console.error(e.message); process.exitCode = 1; }
