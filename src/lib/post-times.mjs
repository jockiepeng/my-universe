import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** @param {string | null} source */
function explicitUpdated(source) {
  const frontmatter = source?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const raw = frontmatter?.match(/^updated:[ \t]*["']?([^\s"'#]+)["']?[ \t]*(?:#.*)?$/m)?.[1];
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.getTime() : null;
}

/**
 * Historical explicit timestamps stay intact. Later edits use the file's own
 * commit time, never build time; a dirty local preview uses its real file mtime.
 * @param {string} filePath
 * @param {Date} created
 * @param {Date | undefined} updated
 * @param {string} root
 */
export async function readPostUpdated(filePath, created, updated, root = process.cwd()) {
  filePath = path.resolve(root, filePath);
  const fallback = updated || created;
  const git = (/** @type {string[]} */ args) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replaceAll('\r\n', '\n'); }
    catch { return null; }
  };
  try {
    const source = (await readFile(filePath, 'utf8')).replaceAll('\r\n', '\n');
    const relative = path.relative(root, filePath).split(path.sep).join('/');
    const history = git(['log', '-1', '--format=%H%n%cI', '--', relative])?.trim().split('\n');
    if (!history?.[0] || !history[1]) return fallback;
    const committed = git(['show', `${history[0]}:${relative}`]);
    const currentExplicit = explicitUpdated(source);
    if (currentExplicit !== explicitUpdated(committed)) return fallback;
    if (committed !== source) {
      return new Date(Math.max(created.getTime(), (await stat(filePath)).mtimeMs));
    }
    const previous = git(['show', `${history[0]}^:${relative}`]);
    if (!previous || currentExplicit !== explicitUpdated(previous)) return fallback;
    const committedAt = new Date(history[1]);
    return Number.isFinite(committedAt.getTime()) ? new Date(Math.max(created.getTime(), committedAt.getTime())) : fallback;
  } catch { return fallback; }
}
