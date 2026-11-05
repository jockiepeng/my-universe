import { withBase } from '../lib/paths.mjs';

interface SearchPage { url: string; meta: { title?: string; type?: string; description?: string }; excerpt: string }
interface SearchModule {
  options: (options: { baseUrl: string }) => Promise<void>;
  search: (query: string) => Promise<{ results: { data: () => Promise<SearchPage> }[] }>;
}

const dialog = document.querySelector<HTMLDialogElement>('#site-search');
const input = document.querySelector<HTMLInputElement>('#search-input');
const results = document.querySelector<HTMLElement>('[data-search-results]');
const status = document.querySelector<HTMLElement>('[data-search-status]');
let modulePromise: Promise<SearchModule> | undefined;
let requestId = 0;
let timer: ReturnType<typeof setTimeout>;

async function getSearch() {
  modulePromise ??= (async () => {
    const url = withBase('/pagefind/pagefind.js', import.meta.env.BASE_URL);
    const module: SearchModule = await import(/* @vite-ignore */ url);
    await module.options({ baseUrl: import.meta.env.BASE_URL });
    return module;
  })().catch(error => { modulePromise = undefined; throw error; });
  return modulePromise;
}

async function search(query: string, id: number) {
  if (!status || !results) return;
  if (!query) { results.replaceChildren(); status.textContent = '输入关键词，搜索文章、贴图、功能与游戏。'; return; }
  status.textContent = '正在找找相关记录…';
  try {
    const module = await getSearch();
    const response = await module.search(query);
    const pages = await Promise.all(response.results.slice(0, 10).map(result => result.data()));
    if (id !== requestId || !dialog?.open) return;
    results.replaceChildren();
    status.textContent = response.results.length ? `找到 ${response.results.length} 条相关结果${response.results.length > 10 ? '，先显示前 10 条' : ''}。` : '还没找到相关记录，试试换个关键词。';
    for (const page of pages) {
      const link = document.createElement('a'); link.href = page.url; link.className = 'u-search-result';
      const title = document.createElement('strong'); title.textContent = page.meta.title || '未命名记录';
      const snippet = document.createElement('p'); snippet.textContent = new DOMParser().parseFromString(page.excerpt, 'text/html').body.textContent;
      if (page.url.includes('/posts/')) {
        title.dataset.i18nSkip = ''; snippet.dataset.i18nSkip = '';
        title.lang = snippet.lang = 'zh-CN';
      } else if (page.meta.description) snippet.textContent = page.meta.description;
      const type = document.createElement('span'); type.className = 'u-search-result-type'; type.textContent = page.meta.type || '文章';
      link.append(title, snippet, type); results.append(link);
    }
  } catch {
    if (id !== requestId || !dialog?.open) return;
    results.replaceChildren(); status.textContent = '搜索暂时不可用，可以先通过导航浏览归档、工具或游戏。';
  }
}

document.querySelector('[data-search-open]')?.addEventListener('click', () => {
  if (!dialog || !input) return;
  dialog.showModal(); input.focus();
  if (input.value.trim()) void search(input.value.trim(), ++requestId);
});
document.querySelector('[data-search-close]')?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
dialog?.addEventListener('close', () => { requestId++; clearTimeout(timer); });
input?.addEventListener('input', () => {
  clearTimeout(timer); const id = ++requestId; const query = input.value.trim();
  if (!query) void search('', id); else timer = setTimeout(() => void search(query, id), 180);
});
