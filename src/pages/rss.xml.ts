import type { APIRoute } from 'astro';
import { getPosts, postHref } from '../lib/posts';
import { summarize } from '../lib/content.mjs';
import { escapeXml } from '../lib/xml.mjs';
import { siteConfig } from '../site.config';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(siteConfig.title)}</title><link>${escapeXml(new URL(import.meta.env.BASE_URL, site).href)}</link><description>${escapeXml(siteConfig.description)}</description><language>zh-CN</language>${posts.map(post => `<item><title>${escapeXml(post.data.title)}</title><link>${escapeXml(new URL(postHref(post), site).href)}</link><guid isPermaLink="true">${escapeXml(new URL(postHref(post), site).href)}</guid><pubDate>${post.data.date.toUTCString()}</pubDate><description>${escapeXml(post.data.summary || summarize(post.body, 240))}</description><category>${escapeXml(post.data.category)}</category></item>`).join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
