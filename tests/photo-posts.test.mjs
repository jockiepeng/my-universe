import test from 'node:test';
import assert from 'node:assert/strict';
import { photoPostIssues, validatePhotoBody } from '../src/lib/photo-posts.mjs';
import { publishedLoader } from '../src/lib/published-loader.mjs';

const images = count => Array.from({ length: count }, (_, i) => ({ src: { src: `/image-${i}.webp` }, alt: `照片 ${i + 1}` }));

test('photo posts require one to nine images and cannot also use an article cover', () => {
  for (const count of [1, 2, 4, 9]) assert.deepEqual(photoPostIssues({ kind: 'photo', images: images(count) }), []);
  for (const count of [0, 10]) assert.match(photoPostIssues({ kind: 'photo', images: images(count) })[0].message, /1.*9/);
  assert.match(photoPostIssues({ kind: 'photo', images: images(1), cover: {} })[0].message, /cover/);
  assert.deepEqual(photoPostIssues({ kind: 'post', images: [], cover: {} }), []);
  assert.match(photoPostIssues({ kind: 'post', images: images(1) })[0].message, /photo/);
});

test('photo text rejects inline, reference, shortcut Markdown images and HTML image containers with a useful filename', () => {
  for (const body of ['![照片](./photo.png)', '![照片][photo]', '![照片]\n\n[照片]: ./photo.png', '<IMG src="photo.png">', '<picture>照片</picture>', '<svg><image href="photo.png" /></svg>']) {
    assert.throws(() => validatePhotoBody(body, '散步.md'), /散步\.md.*images/);
  }
  assert.doesNotThrow(() => validatePhotoBody('今天很开心！\n第二行文字。\n\nhttps://example.com\n<strong>只是文字</strong>', '散步.md'));
});

test('production loader removes draft entries before Astro collects their images, while dev retains them', async () => {
  for (const includeDrafts of [false, true]) {
    const store = new Map();
    let didLoad = false;
    const loader = publishedLoader({ name: 'fixture', async load(context) {
      didLoad = true;
      context.store.set('article', { data: { kind: 'post', draft: false } });
      context.store.set('photo', { data: { kind: 'photo', draft: false } });
      context.store.set('draft', { data: { kind: 'photo', draft: true }, assetImports: ['./private.png'] });
    } }, includeDrafts);
    await loader.load({ store });
    assert.ok(didLoad);
    assert.deepEqual([...store.keys()], includeDrafts ? ['article', 'photo', 'draft'] : ['article', 'photo']);
  }
});
