import type { APIRoute } from 'astro';
import { getPosts, href, postHref } from '../lib/posts';
import { topics, matchesCategory } from '../lib/topics.mjs';
import { escapeXml } from '../lib/xml.mjs';
import { siteConfig } from '../site.config';
import { games } from '../lib/games';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  const tags = [...new Set(posts.flatMap(post => post.data.tags))];
  const activeTopics = topics.filter(topic => posts.some(post => matchesCategory(post.data.category, topic.path)));
  const paths = [href('/'), href('/archive/'), href('/about/'), ...activeTopics.map(topic => href(`/categories/${topic.slug}/`)), ...tags.map(tag => href(`/tags/${encodeURIComponent(tag)}/`)), ...posts.map(postHref), ...Array.from({ length: Math.max(0, Math.ceil(posts.length / siteConfig.pageSize) - 1) }, (_, i) => href(`/page/${i + 2}/`))];
  paths.push(href('/games/'), ...games.map(game => href(game.href)));
  paths.push(href('/tools/'), href('/tools/life/'), href('/tools/life-replay/'));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
