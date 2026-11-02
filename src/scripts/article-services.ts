import { canCountView } from '../lib/services.mjs';

const productionOrigin = document.body.dataset.productionOrigin || '';
const production = canCountView(import.meta.env.PROD, location.origin, productionOrigin);
const views = document.querySelector<HTMLElement>('[data-page-views]');

if (views && production) {
  const value = document.querySelector<HTMLElement>('#busuanzi_value_page_pv');
  const container = document.querySelector<HTMLElement>('#busuanzi_container_page_pv');
  const fallback = document.querySelector<HTMLElement>('[data-views-fallback]');
  let timeout: ReturnType<typeof setTimeout>;
  const observer = new MutationObserver(() => {
    if (!value || !/^\d[\d,]*$/.test(value.textContent?.trim() || '')) return;
    if (fallback) fallback.hidden = true;
    if (container) container.style.display = 'inline';
    views.title = '页面浏览次数，重复访问可能再次计数';
    observer.disconnect(); clearTimeout(timeout);
  });
  if (value) observer.observe(value, { childList: true, subtree: true, characterData: true });
  const script = document.createElement('script');
  script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  script.async = true;
  script.onerror = () => { views.title = '阅读统计暂不可用'; observer.disconnect(); clearTimeout(timeout); };
  timeout = setTimeout(() => { views.title = '阅读统计暂不可用'; }, 12000);
  document.head.append(script);
} else if (views) {
  views.title = '本地预览不记录阅读量，正式站点显示真实浏览次数';
}

const comments = document.querySelector<HTMLElement>('[data-giscus]');
if (comments) {
  let loaded = false;
  const status = comments.querySelector<HTMLElement>('[data-comment-status]');
  const theme = () => document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches) ? 'dark' : 'light';
  const loadComments = () => {
    if (loaded) return;
    loaded = true;
    const script = document.createElement('script');
    const attributes: Record<string, string> = {
      src: 'https://giscus.app/client.js',
      'data-repo': comments.dataset.repo || '',
      'data-repo-id': comments.dataset.repoId || '',
      'data-category': comments.dataset.category || '',
      'data-category-id': comments.dataset.categoryId || '',
      'data-mapping': 'pathname',
      'data-strict': '1',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'top',
      'data-theme': theme(),
      'data-lang': 'zh-CN',
      'data-loading': 'lazy',
      crossorigin: 'anonymous',
      async: '',
    };
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    script.onerror = () => { if (status) status.textContent = '评论暂时无法加载，你仍然可以前往 GitHub Discussions 参与讨论。'; };
    comments.append(script);
  };
  if (!production) {
    if (status) status.textContent = '本地预览不加载评论，发布后可使用 GitHub 账号参与讨论。';
  } else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { loadComments(); observer.disconnect(); } }, { rootMargin: '200px' });
    observer.observe(comments);
  } else loadComments();
  window.addEventListener('universe:appearance', () => {
    comments.querySelector<HTMLIFrameElement>('iframe.giscus-frame')?.contentWindow?.postMessage({ giscus: { setConfig: { theme: theme() } } }, 'https://giscus.app');
  });
  window.addEventListener('message', event => {
    const frame = comments.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
    if (event.origin !== 'https://giscus.app' || event.source !== frame?.contentWindow || !event.data?.giscus) return;
    if (event.data.giscus.error && status) status.textContent = '评论暂时无法加载，可以前往 GitHub Discussions 查看。';
    else if (status) status.hidden = true;
  });
}
