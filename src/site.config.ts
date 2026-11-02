export const siteConfig = {
  title: '个人小宇宙',
  description: '一些日常，一些思考，还有路上捡到的经验。在自己的小宇宙里，慢慢记录。',
  intro: '写下生活，\n也写下新的发现。',
  github: 'https://github.com/jockiepeng/my-universe',
  pageSize: 10,
  // 按需填写公开联系链接，例如 { label: 'GitHub', href: 'https://github.com/你的账号' }。
  contactLinks: [] as { label: string; href: string }[],
};

export const giscusConfig = {
  repo: import.meta.env.PUBLIC_GISCUS_REPO || 'jockiepeng/my-universe',
  repoId: import.meta.env.PUBLIC_GISCUS_REPO_ID || '',
  category: import.meta.env.PUBLIC_GISCUS_CATEGORY || '博客评论',
  categoryId: import.meta.env.PUBLIC_GISCUS_CATEGORY_ID || '',
};
