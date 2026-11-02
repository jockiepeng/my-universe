import test from 'node:test';
import assert from 'node:assert/strict';
import { withBase, normalizeBase, absoluteUrl } from '../src/lib/paths.mjs';

test('root and project bases preserve article and asset URLs', () => {
  assert.equal(normalizeBase('/my-universe/'), '/my-universe');
  assert.equal(normalizeBase('/'), '');
  assert.equal(withBase('/posts/hello/', '/my-universe'), '/my-universe/posts/hello/');
  assert.equal(withBase('/rss.xml', '/'), '/rss.xml');
  assert.equal(withBase('/', '/my-universe/'), '/my-universe/');
  assert.equal(withBase('/posts/hello/', ''), '/posts/hello/');
});

test('canonical URLs retain the project path', () => {
  assert.equal(absoluteUrl('/posts/hello/', 'https://jockiepeng.github.io', '/my-universe'), 'https://jockiepeng.github.io/my-universe/posts/hello/');
});
