export { categories, categorySlug, categoryBreadcrumbs, matchesCategory, filterPosts, topicTree } from './topics.mjs';

/** @template {{ id: string, data: { date: Date, draft?: boolean } }} T
 * @param {T[]} entries @param {boolean} includeDrafts @returns {T[]} */
export function publishedPosts(entries, includeDrafts = false) {
  return entries.filter(entry => includeDrafts || !entry.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}

export function summarize(markdown = '', length = 100) {
  const plain = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/[#*_`>~|]/g, '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(plain);
  return chars.length > length ? `${chars.slice(0, length).join('')}…` : plain;
}

export function readingMinutes(markdown = '') {
  const chinese = (markdown.match(/\p{Script=Han}/gu) || []).length;
  const words = (markdown.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/gi) || []).length;
  return Math.max(1, Math.ceil(chinese / 300 + words / 200));
}

export const formatDate = date => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai',
}).format(date);

export const formatDateTime = date => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23', timeZone: 'Asia/Shanghai',
}).format(date);
