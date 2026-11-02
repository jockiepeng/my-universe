import { getCollection, type CollectionEntry } from 'astro:content';
import { publishedPosts } from './content.mjs';
import { withBase } from './paths.mjs';

export type Post = CollectionEntry<'posts'>;
export const href = (path = '/') => withBase(path, import.meta.env.BASE_URL);
export const postHref = (post: Post) => href(`/posts/${post.data.slug}/`);

export async function getPosts() {
  const entries = await getCollection('posts');
  const slugs = new Set<string>();
  for (const entry of entries) {
    if (slugs.has(entry.data.slug)) throw new Error(`文章 slug 重复：${entry.data.slug}`);
    slugs.add(entry.data.slug);
  }
  return publishedPosts(entries, import.meta.env.DEV);
}
