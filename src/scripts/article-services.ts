import { canCountView } from '../lib/services.mjs';

const productionOrigin = document.body.dataset.productionOrigin || '';
const production = canCountView(import.meta.env.PROD, location.origin, productionOrigin);

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
