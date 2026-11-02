import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { normalizeBase } from '../src/lib/paths.mjs';

const base = normalizeBase(process.env.BASE_PATH ?? '/my-universe');
const output = path.resolve('dist');
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
const files = await filesIn(output);
const documents = files.filter(file => /\.(html|xml|txt|json|js)$/.test(file));
let links = 0;
for (const file of documents) {
  const contents = await readFile(file, 'utf8');
  assert.ok(!contents.includes('DRAFT_ONLY_SENTINEL_7bf1'), `草稿泄露：${file}`);
  if (!file.endsWith('.html')) continue;
  assert.ok(!contents.includes('busuanzi_container_site_pv'), `不应存在全站计数：${file}`);
  for (const [, raw] of contents.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!raw.startsWith('/') || raw.startsWith('//')) continue;
    const url = new URL(raw.replaceAll('&amp;', '&'), 'https://check.invalid');
    const decoded = decodeURIComponent(url.pathname);
    const decodedBase = decodeURIComponent(base);
    assert.ok(!base || decoded === decodedBase || decoded.startsWith(`${decodedBase}/`), `链接遗漏基础路径：${raw} in ${file}`);
    const relative = decoded.slice(decodedBase.length).replace(/^\/+/, '');
    const target = path.join(output, relative, decoded.endsWith('/') ? 'index.html' : '');
    await access(target).catch(() => { throw new Error(`链接目标不存在：${raw} in ${file}`); });
    links++;
  }
}
await access(path.join(output, 'pagefind', 'pagefind.js'));
const index = JSON.parse(await readFile(path.join(output, 'pagefind', 'pagefind-entry.json'), 'utf8'));
const indexedPages = Object.values(index.languages).reduce((sum, language) => sum + language.page_count, 0);
const articleFiles = files.filter(file => file.includes(`${path.sep}posts${path.sep}`) && file.endsWith('.html'));
assert.equal(indexedPages, articleFiles.length, '搜索应只索引正式文章详情');
assert.ok(!files.some(file => file.includes(`${path.sep}draft-example${path.sep}`)), '草稿不应生成静态路由');
console.log(`产物检查通过：${files.length} 个文件，${links} 个站内资源/链接，${indexedPages} 篇可搜索文章；无草稿泄露。`);
