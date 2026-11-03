import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as content from '../src/lib/content.mjs';

const post = (category, kind = 'post', id = category) => ({ id, data: { category, kind } });

test('hierarchical categories have stable nested URLs and reject unknown paths', () => {
  assert.equal(content.categorySlug('技术'), 'technology');
  assert.equal(content.categorySlug('技术/AI'), 'technology/ai');
  assert.equal(content.categorySlug('技术/Go'), 'technology/go');
  assert.equal(content.categorySlug('技术/数据库'), 'technology/databases');
  assert.equal(content.categorySlug('生活/人际关系'), 'life/relationships');
  assert.equal(content.categorySlug('生活/运动'), 'life/sports');
  assert.throws(() => content.categorySlug('随想'), /未知分类/);
  assert.deepEqual(content.categoryBreadcrumbs('技术/AI').map(item => item.path), ['技术', '技术/AI']);
});

test('parent selection includes descendants and respects full path boundaries', () => {
  assert.equal(content.matchesCategory('技术', '技术'), true);
  assert.equal(content.matchesCategory('技术/AI/编程', '技术'), true);
  assert.equal(content.matchesCategory('技术/AI/编程', '技术/AI'), true);
  assert.equal(content.matchesCategory('技术/AI工具', '技术/AI'), false);
  assert.equal(content.matchesCategory('技术栈/AI', '技术'), false);
  assert.equal(content.matchesCategory('生活/人际关系', ''), true);
});

test('category and kind filters compose across all entries without mutating input', () => {
  const entries = [post('技术/AI'), post('生活/人际关系', 'photo'), post('技术/Go'), post('技术/AI', 'photo', 'late')];
  assert.deepEqual(content.filterPosts(entries, { category: '技术' }).map(p => p.id), ['技术/AI', '技术/Go', 'late']);
  assert.deepEqual(content.filterPosts(entries, { category: '技术/AI', kind: 'photo' }).map(p => p.id), ['late']);
  assert.deepEqual(content.filterPosts(entries, { category: '技术/Go', kind: 'photo' }), []);
  assert.deepEqual(content.filterPosts(entries), entries);
  assert.equal(entries.length, 4);
});

test('topic navigation counts descendants once and hides topics without published entries', () => {
  const entries = [post('技术/AI'), post('技术'), post('生活/人际关系', 'photo')];
  const tree = content.topicTree(entries);
  assert.deepEqual(tree.map(({ path, count }) => ({ path, count })), [{ path: '技术', count: 2 }, { path: '生活', count: 1 }]);
  assert.deepEqual(tree[0].children.map(({ path, count }) => ({ path, count })), [{ path: '技术/AI', count: 1 }]);
  assert.equal(tree[1].children[0].path, '生活/人际关系');
  assert.deepEqual(content.topicTree([]), []);
});

test('documented reusable photo template uses a category accepted by the content schema', async () => {
  const template = await readFile(new URL('../drafts/贴图模板.md', import.meta.url), 'utf8');
  const category = template.match(/^category:\s*(.+)$/m)?.[1].trim();
  assert.ok(content.categories.includes(category), `贴图模板分类应在配置中：${category}`);
});
