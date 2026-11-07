import { filterMomentIndex, MOMENTS_PAGE_SIZE } from '../lib/moments-search.mjs';

type IndexItem = { id: string; createdAt: string; day: string; text: string; page: number };
type Reply = { bodyHTML: string; createdAt: string; author: { login: string } | null };
type Moment = { id: string; bodyHTML: string; createdAt: string; updatedAt: string; url: string; author: { login: string; avatarUrl: string }; replies?: Reply[] };
const section = document.querySelector<HTMLElement>('[data-moments-base]');
if (section) {
  const form = section.querySelector<HTMLFormElement>('[data-moments-filters]')!;
  const feed = section.querySelector<HTMLElement>('.moments-feed')!;
  const status = section.querySelector<HTMLElement>('[data-moments-status]')!;
  const nav = section.querySelector<HTMLElement>('[data-moments-pagination]')!;
  const previous = nav.querySelector<HTMLButtonElement>('[data-previous]')!;
  const next = nav.querySelector<HTMLButtonElement>('[data-next]')!;
  const label = nav.querySelector<HTMLElement>('[data-page-label]')!;
  const order = section.querySelector<HTMLSelectElement>('#moments-order')!;
  const base = section.dataset.momentsBase!;
  const total = Number(section.dataset.momentsTotal);
  let indexPromise: Promise<IndexItem[]> | undefined;
  const pages = new Map<number, Promise<Moment[]>>();
  let page = 1, version = 0, timer = 0;
  const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const esc = (value: string) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const time = (value: string) => `<time datetime="${esc(value)}">${esc(date.format(new Date(value)))}</time>`;
  const renderCard = (m: Moment) => `<article class="moment-card" data-i18n-skip><div class="moment-avatar"><img src="${esc(m.author.avatarUrl)}" alt="" loading="lazy"></div><div class="moment-main"><header class="moment-meta"><strong>${esc(m.author.login)}</strong><span class="moment-times">${time(m.createdAt)}${m.updatedAt && m.updatedAt !== m.createdAt ? `<small>编辑于 ${time(m.updatedAt)}</small>` : ''}</span></header><div class="moment-body">${m.bodyHTML}</div>${m.replies?.length ? `<div class="moment-replies"><h3>回复 <span>${m.replies.length}</span></h3>${m.replies.map(r => `<article class="moment-response"><div class="response-meta"><strong>${esc(r.author?.login || '已删除用户')}</strong>${time(r.createdAt)}</div><div class="moment-body">${r.bodyHTML}</div></article>`).join('')}</div>` : ''}<a class="moment-reply" href="#moments-discussion">在页面中回复</a><a class="moment-reply moment-original" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">查看、编辑或删除</a></div></article>`;
  async function json<T>(url: string): Promise<T> { const response = await fetch(url); if (!response.ok) throw new Error('fetch failed'); return response.json(); }
  function getIndex() { return indexPromise ||= json<IndexItem[]>(`${base}index.json`).catch(error => { indexPromise = undefined; throw error; }); }
  function getPage(n: number) { if (!pages.has(n)) pages.set(n, json<Moment[]>(`${base}${n}.json`).catch(error => { pages.delete(n); throw error; })); return pages.get(n)!; }
  async function update() {
    const current = ++version;
    status.textContent = '正在加载动态…';
    try {
      const data = new FormData(form);
      const matches = filterMomentIndex(await getIndex(), { query: String(data.get('query') || ''), from: String(data.get('from') || ''), to: String(data.get('to') || ''), order: order.value });
      const count = matches.length, max = Math.max(1, Math.ceil(count / MOMENTS_PAGE_SIZE));
      page = Math.min(page, max);
      const selected: IndexItem[] = matches.slice((page - 1) * MOMENTS_PAGE_SIZE, page * MOMENTS_PAGE_SIZE);
      const batches = await Promise.all([...new Set(selected.map(item => item.page))].map(getPage));
      if (current !== version) return;
      const byId = new Map(batches.flat().map(m => [m.id, m]));
      feed.innerHTML = selected.map(item => byId.get(item.id)).filter((m): m is Moment => Boolean(m)).map(renderCard).join('');
      status.textContent = count ? `找到 ${count} 条动态` : '没有找到符合条件的动态。';
      label.textContent = `第 ${page} / ${max} 页`;
      nav.hidden = count <= MOMENTS_PAGE_SIZE;
      previous.disabled = page <= 1; next.disabled = page >= max;
    } catch {
      if (current === version) status.textContent = '加载失败，请检查网络后重试。';
    }
  }
  form.hidden = false;
  nav.hidden = total <= MOMENTS_PAGE_SIZE;
  previous.disabled = true;
  label.textContent = `第 1 / ${Math.max(1, Math.ceil(total / MOMENTS_PAGE_SIZE))} 页`;
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => { page = 1; ++version; clearTimeout(timer); timer = window.setTimeout(update, 200); });
  form.addEventListener('reset', () => { page = 1; window.setTimeout(update, 0); });
  order.addEventListener('change', () => { page = 1; update(); });
  previous.addEventListener('click', () => { if (page > 1) { page--; update(); } });
  next.addEventListener('click', () => { page++; update(); });
}
