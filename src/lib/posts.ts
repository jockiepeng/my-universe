import { getCollection, type CollectionEntry } from 'astro:content';
import { publishedPosts } from './content.mjs';
import { withBase } from './paths.mjs';
import { validatePhotoBody } from './photo-posts.mjs';
import { readPostUpdated } from './post-times.mjs';

export type Post = CollectionEntry<'posts'>;
export const href = (path = '/') => withBase(path, import.meta.env.BASE_URL);
export const postHref = (post: Post) => href(`/posts/${post.data.slug}/`);

async function loadPosts() {
  const entries = await getCollection('posts');
  const slugs = new Set<string>();
  for (const entry of entries) {
    if (entry.data.kind === 'photo') validatePhotoBody(entry.body, entry.id);
    if (slugs.has(entry.data.slug)) throw new Error(`文章 slug 重复：${entry.data.slug}`);
    slugs.add(entry.data.slug);
  }
  const dated = await Promise.all(entries.map(async entry => ({ ...entry, data: {
    ...entry.data,
    updated: await readPostUpdated(`src/content/posts/${entry.id}.md`, entry.data.date, entry.data.updated),
  } })));
  return publishedPosts(dated, import.meta.env.DEV);
}
let postsPromise: ReturnType<typeof loadPosts> | undefined;
export async function getPosts() {
  return import.meta.env.DEV ? loadPosts() : (postsPromise ??= loadPosts());
}
