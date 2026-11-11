import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPostListed } from '../scripts/lib/content-list-review.mjs';
test('published detail requires both a paginated listing and archive entry', () => {
  const link = '<a href="/my-universe/posts/%E6%B5%8B%E8%AF%95/">Title</a>';
  assert.doesNotThrow(() => assertPostListed('posts/测试/index.html', '/my-universe', [link], link));
  assert.throws(() => assertPostListed('posts/测试/index.html', '/my-universe', [''], link), /首页/);
  assert.throws(() => assertPostListed('posts/测试/index.html', '/my-universe', [link], ''), /归档/);
});
