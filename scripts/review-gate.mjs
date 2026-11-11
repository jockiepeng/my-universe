import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { renderReview } from './lib/review-document.mjs';

const reportArtifact = /^docs\/reviews\/[^/]+\.(json|md)$/;
const reportPath = /^docs\/reviews\/[^/]+\.json$/;
const text = value => typeof value === 'string' && value.trim().length >= 8;
function git(...args) { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim(); }
function show(tree, file) {
  try { return execFileSync('git', ['show', `${tree}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }); }
  catch { return ''; }
}
function entries(tree) {
  return git('ls-tree', '-rz', '--full-tree', tree).split('\0').filter(Boolean).map(line => {
    const tab = line.indexOf('\t'); return { meta: line.slice(0, tab), file: line.slice(tab + 1) };
  });
}
function snapshot(tree) {
  return createHash('sha256').update(entries(tree).filter(e => !reportArtifact.test(e.file)).map(e => `${e.meta}\t${e.file}\0`).join('')).digest('hex');
}
function parents(commit) { return git('rev-list', '--parents', '-n', '1', commit).split(' ').slice(1); }
function current(amend = process.env.REVIEW_GATE_AMEND === '1' || process.argv.slice(2).includes('--amend')) {
  let merging = [];
  try { merging = readFileSync(git('rev-parse', '--git-path', 'MERGE_HEAD'), 'utf8').trim().split('\n').filter(Boolean); } catch { /* no merge */ }
  if (amend && merging.length) throw new Error('合并进行中不可使用 amend 模式。');
  const intendedParents = amend ? parents('HEAD') : [git('rev-parse', 'HEAD'), ...merging];
  if (!intendedParents.length) throw new Error('暂不支持 amend 仓库的根提交。');
  return { tree: git('write-tree'), parents: intendedParents };
}
function ensureWorkspace() {
  if (git('diff', '--name-only', '-z', '--', '.', ':(exclude)docs/reviews/*.json', ':(exclude)docs/reviews/*.md') || git('ls-files', '--others', '--exclude-standard', '-z', '--', '.', ':(exclude)docs/reviews/*.json', ':(exclude)docs/reviews/*.md')) {
    throw new Error('请先暂存所有待审查文件；工作区必须与暂存区一致（报告文件除外）。');
  }
}
const sections = {
  added: [['功能内容'], ['使用方式', '更新方式'], ['技术原理']],
  fixed: [['原来的问题', '原来的情况'], ['处理方式'], ['更新后的效果'], ['技术原理']],
  improved: [['原来的情况'], ['优化方式', '处理方式'], ['更新后的效果'], ['技术原理']],
  removed: [['删除内容'], ['删除原因'], ['对使用的影响', '使用影响']],
};
function validateChangelog(tree, parent, featureChanges) {
  const file = 'src/data/changelog.json';
  const before = JSON.parse(show(parent, file) || '[]');
  const after = JSON.parse(show(tree, file) || '[]');
  const changed = after.filter(e => !before.some(old => JSON.stringify(e) === JSON.stringify(old)));
  if (featureChanges && !changed.length) throw new Error('功能变化缺少功能专区更新。');
  for (const entry of changed) {
    if (!sections[entry.type] || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !text(entry.text) || !text(entry.en) || !Array.isArray(entry.details)) throw new Error('功能专区缺少日期、类型、双语摘要或详情。');
    for (const part of entry.details) {
      if (![part.title, part.enTitle, part.text, part.en].every(v => typeof v === 'string' && v.trim()) || !text(part.text) || !text(part.en)) throw new Error('功能专区详情缺少双语内容。');
    }
    for (const aliases of sections[entry.type]) {
      if (!entry.details.some(d => aliases.includes(d.title))) throw new Error(`功能专区 ${entry.type} 缺少 ${aliases.join('/')}。`);
    }
  }
}
function scanSecrets(tree, parent) {
  const patch = git('diff', '--no-ext-diff', '--unified=0', parent, tree, '--', '.');
  const added = patch.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, /\bAKIA[A-Z0-9]{16}\b/, /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/];
  if (patterns.some(p => p.test(added))) throw new Error('疑似凭证/私钥：已阻止操作，请审查新增内容（不输出原文）。');
  for (const e of entries(tree)) {
    if (/\/(?:\.env(?:\..+)?|id_rsa|id_ed25519)$/.test(`/${e.file}`) && !e.file.endsWith('.env.example')) throw new Error('禁止提交环境密钥文件。');
  }
}
function validateReport(r, tree, expectedParents) {
  const hash = snapshot(tree);
  if (r.version !== 1 || r.snapshot !== hash || JSON.stringify(r.parents) !== JSON.stringify(expectedParents)) throw new Error('报告与代码快照/父提交不符。');
  if (typeof r.reviewer !== 'string' || !r.reviewer.trim() || typeof r.featureChanges !== 'boolean' || !Array.isArray(r.concerns) || !r.concerns.every(text) || !Array.isArray(r.redLines) || r.redLines.length) throw new Error('报告存在红线或未填写审查信息。');
  for (const key of ['privacy', 'changelog', 'content', 'bugs']) {
    const c = r.checks?.[key];
    if (c?.status !== 'pass' || !text(c.evidence)) throw new Error(`报告 ${key} 未通过或缺少审查证据。`);
  }
  if (r.verification?.status !== 'pass' || r.verification.command !== 'npm run verify' || r.verification.snapshot !== hash) throw new Error('报告缺少当前快照的 npm run verify 成功记录。');
  validateChangelog(tree, expectedParents[0], r.featureChanges);
  scanSecrets(tree, expectedParents[0]);
}
function check(tree, expectedParents) {
  const errors = [];
  for (const { file } of entries(tree).filter(e => reportPath.test(e.file))) {
    try { const r = JSON.parse(show(tree, file)); validateReport(r, tree, expectedParents);
      if (show(tree, file.replace(/\.json$/, '.md')) !== renderReview(r)) throw new Error('Markdown report missing or out of sync; run review:render.');
      console.log(`Review 通过：${file}`); return; }
    catch (e) { errors.push(`${file}: ${e.message}`); }
  }
  throw new Error(`缺少有效 Review 报告。\n${errors.join('\n')}`);
}
function reportFile(file) {
  if (!reportPath.test(file ?? '')) throw new Error('报告路径必须为 docs/reviews/<name>.json');
  return file;
}
try {
  process.chdir(git('rev-parse', '--show-toplevel'));
  const [command, arg] = process.argv.slice(2);
  if (command === 'init') {
    const file = reportFile(arg); const state = current();
    mkdirSync(path.dirname(file), { recursive: true });
    const r = { version: 1, parents: state.parents, snapshot: snapshot(state.tree), reviewer: '', featureChanges: null,
      redLines: [], concerns: [], checks: Object.fromEntries(['privacy', 'changelog', 'content', 'bugs'].map(key => [key, { status: 'pending', evidence: '' }])), verification: { status: 'pending' } };
    writeFileSync(file, JSON.stringify(r, null, 2) + '\n', { flag: 'wx' });
    writeFileSync(file.replace(/\.json$/, '.md'), renderReview(r), { flag: 'wx' });
    console.log(`报告草稿已创建：${file}；填写真实证据后运行 review:verify。`);
  } else if (command === 'verify') {
    const file = reportFile(arg); const state = current(); const hash = snapshot(state.tree);
    const r = JSON.parse(readFileSync(file));
    // Invalidate prior success before starting any new verification attempt.
    r.verification = { status: 'pending' }; writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
    writeFileSync(file.replace(/\.json$/, '.md'), renderReview(r));
    ensureWorkspace();
    validateReport({ ...r, verification: { status: 'pass', command: 'npm run verify', snapshot: hash } }, state.tree, state.parents);
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'verify'], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) throw new Error('npm run verify 失败，禁止放行。');
    ensureWorkspace();
    if (snapshot(current().tree) !== hash || JSON.stringify(current().parents) !== JSON.stringify(state.parents)) throw new Error('验证期间代码或父提交发生变化，请重新审查。');
    r.verification = { status: 'pass', command: 'npm run verify', snapshot: hash, completedAt: new Date().toISOString() };
    writeFileSync(file, JSON.stringify(r, null, 2) + '\n');
    writeFileSync(file.replace(/\.json$/, '.md'), renderReview(r));
    console.log('验证通过；请暂存两份报告，再提交。');
  } else if (command === 'render') {
    const file = reportFile(arg);
    writeFileSync(file.replace(/\.json$/, '.md'), renderReview(JSON.parse(readFileSync(file))));
  } else if (command === 'amend') {
    const state = current(true); check(state.tree, state.parents);
    const result = spawnSync('git', ['commit', '--amend', ...process.argv.slice(3)], {
      stdio: 'inherit', env: { ...process.env, REVIEW_GATE_AMEND: '1' },
    });
    if (result.status !== 0) throw new Error('amend 失败。');
  } else if (command === 'commit') {
    const state = current(); check(state.tree, state.parents);
  } else if (command === 'push') {
    const input = readFileSync(0, 'utf8');
    for (const line of input.trim().split('\n').filter(Boolean)) {
      const [, local, , remote] = line.trim().split(/\s+/);
      if (!/^[0-9a-f]{40,64}$/.test(local ?? '') || !/^[0-9a-f]{40,64}$/.test(remote ?? '')) throw new Error('无效 push 输入。');
      if (/^0+$/.test(local)) continue;
      const revisions = /^0+$/.test(remote) ? [local, '--not', '--remotes'] : [`${remote}..${local}`];
      for (const commit of git('rev-list', '--reverse', ...revisions).split('\n').filter(Boolean)) check(commit, parents(commit));
    }
  } else { throw new Error('用法：review-gate.mjs init <report> | verify <report> | commit | push'); }
} catch (e) { console.error(`Review 门禁：${e.message}`); process.exitCode = 1; }
