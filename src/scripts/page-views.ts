import { canCountView } from '../lib/services.mjs';

const production = canCountView(import.meta.env.PROD, location.origin, document.body.dataset.productionOrigin || '');
const counters = [
  { selector: '[data-page-views]', key: 'page_pv', title: '页面浏览次数，重复访问可能再次计数', error: '阅读统计暂不可用' },
  { selector: '[data-site-views]', key: 'site_pv', title: '全站页面浏览次数，刷新或重复打开可能再次计数', error: '浏览统计暂不可用' },
];
const failures: (() => void)[] = [];
for (const counter of counters) {
  const root = document.querySelector<HTMLElement>(counter.selector);
  if (!root) continue;
  if (!production) {
    root.title = '本地预览不记录浏览量，正式站点显示真实浏览次数';
    continue;
  }
  const value = root.querySelector<HTMLElement>(`#busuanzi_value_${counter.key}`);
  const container = root.querySelector<HTMLElement>(`#busuanzi_container_${counter.key}`);
  const fallback = root.querySelector<HTMLElement>('[data-views-fallback]');
  let timeout: ReturnType<typeof setTimeout>;
  const observer = new MutationObserver(() => {
    if (!value || !/^\d[\d,]*$/.test(value.textContent?.trim() || '')) return;
    if (fallback) fallback.hidden = true;
    if (container) container.style.display = 'inline';
    root.title = counter.title;
    observer.disconnect(); clearTimeout(timeout);
  });
  if (value) observer.observe(value, { childList: true, subtree: true, characterData: true });
  timeout = setTimeout(() => { root.title = counter.error; }, 12000);
  failures.push(() => { root.title = counter.error; observer.disconnect(); clearTimeout(timeout); });
}

// Run on every production page, including pages with no visible counter.
// Article and site PV share this request; loading a second script would double-count.
if (production) {
  const script = document.createElement('script');
  script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  script.async = true;
  script.onerror = () => failures.forEach(fail => fail());
  document.head.append(script);
}
