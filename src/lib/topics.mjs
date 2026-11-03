/** @typedef {{ path: string, label: string, slug: string, description: string }} Topic */
/** @typedef {Topic & { count: number, children: TopicNode[] }} TopicNode */

/** @type {Topic[]} */
export const topics = [
  { path: '技术', label: '技术', slug: 'technology', description: '开发、工具与工程实践。' },
  { path: '技术/AI', label: 'AI', slug: 'technology/ai', description: 'AI 工具、编程探索与知识库实践。' },
  { path: '技术/Go', label: 'Go', slug: 'technology/go', description: 'Go 语言与开发实践。' },
  { path: '技术/数据库', label: '数据库', slug: 'technology/databases', description: '数据存储、查询与数据库实践。' },
  { path: '生活', label: '生活', slug: 'life', description: '生活经验与值得记录的日常。' },
  { path: '生活/人际关系', label: '人际关系', slug: 'life/relationships', description: '与人相处、沟通和建立信任。' },
  { path: '生活/运动', label: '运动', slug: 'life/sports', description: '运动体验、练习与从中获得的生活感悟。' },
];

export const categories = topics.map(topic => topic.path);

/** @param {string} category */
export function categorySlug(category) {
  const topic = topics.find(topic => topic.path === category);
  if (!topic) throw new Error(`未知分类：${category}，请在 src/lib/topics.mjs 中配置。`);
  return topic.slug;
}

/** @param {string} category @returns {Topic[]} */
export function categoryBreadcrumbs(category) {
  categorySlug(category);
  return category.split('/').map((_, index, segments) => {
    const path = segments.slice(0, index + 1).join('/');
    const topic = topics.find(topic => topic.path === path);
    if (!topic) throw new Error(`分类缺少父级：${path}`);
    return topic;
  });
}

/** @param {string} category @param {string} selected */
export function matchesCategory(category, selected) {
  return !selected || category === selected || category.startsWith(`${selected}/`);
}

/**
 * @template {{ data: { category: string, kind?: string } }} T
 * @param {T[]} posts
 * @param {{ category?: string, kind?: string }} [selection]
 * @returns {T[]}
 */
export function filterPosts(posts, { category = '', kind = 'all' } = {}) {
  return posts.filter(post => matchesCategory(post.data.category, category)
    && (kind === 'all' || post.data.kind === kind));
}

/** @param {{ data: { category: string } }[]} posts @returns {TopicNode[]} */
export function topicTree(posts) {
  /** @param {string} parent @returns {TopicNode[]} */
  const childrenOf = parent => topics
    .filter(topic => topic.path.split('/').slice(0, -1).join('/') === parent)
    .map(topic => ({ ...topic, count: posts.filter(post => matchesCategory(post.data.category, topic.path)).length, children: childrenOf(topic.path) }))
    .filter(topic => topic.count > 0);
  return childrenOf('');
}
