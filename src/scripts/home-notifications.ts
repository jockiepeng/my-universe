import { recentNews, newsReadKey } from '../lib/news.mjs';
import { loadNewsRead } from '../lib/news-read.mjs';
import { overduePlans } from '../lib/plan-notifications.mjs';

const root = document.querySelector<HTMLElement>('[data-home-notifications]');
if (root) {
  const key = 'universe:plan-notifications:read:v1';
  const moments = JSON.parse(root.dataset.plans || '[]');
  const reports: {id: string; date: string}[] = JSON.parse(root.dataset.news || '[]');
  const newsPanel = root.querySelector<HTMLElement>('[data-news-notifications]')!;
  const newsList = root.querySelector<HTMLUListElement>('[data-news-notification-list]')!;
  const list = root.querySelector<HTMLUListElement>('[data-notification-list]')!;
  const dots = root.querySelectorAll<HTMLElement>('[data-notification-dot]');
  const menu = root.querySelector<HTMLDetailsElement>('[data-profile-menu]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-notification-dialog]')!;
  let read = new Set<string>();
  let ids: string[] = [];
  function loadRead() {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(stored)) read = new Set(stored.filter((id): id is string => typeof id === 'string'));
    } catch { /* Keep in-memory read state when storage is unavailable. */ }
  }
  function showUnread() { dots.forEach(dot => { dot.hidden = !ids.some(id => !read.has(id)) && recentNews(reports, loadNewsRead()).length === 0; }); }
  function markRead() {
    loadRead();
    ids.forEach(id => read.add(id));
    try { localStorage.setItem(key, JSON.stringify([...read].slice(-2000))); } catch { /* Reading still works for this visit. */ }
    showUnread();
  }
  function update() {
    if (!root) return;
    const plans: { id: string; title: string; date: string; days: number; status: string }[] = overduePlans(moments);
    ids = plans.map(plan => plan.id);
    const news: {id: string; date: string}[] = recentNews(reports, loadNewsRead());
    newsPanel.hidden = news.length === 0;
    newsList.replaceChildren(...news.map(report => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `${root!.dataset.newsBase}${report.date}/`;
      link.textContent = `${report.date} 日报`;
      link.dataset.i18nEn = `${report.date} daily briefing`;
      item.append(link);
      return item;
    }));
    root.querySelector<HTMLElement>('[data-notification-empty]')!.hidden = plans.length + news.length > 0;
    root.querySelector<HTMLElement>('[data-plan-notifications]')!.hidden = plans.length === 0;
    root.querySelector('[data-notification-count]')!.textContent = `（${plans.length + news.length}）`;
    list.replaceChildren(...plans.map(plan => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = root.querySelector<HTMLAnchorElement>('.notification-panel > a')!.href;
      link.textContent = plan.title;
      const meta = document.createElement('span');
      meta.textContent = `${plan.date} · 逾期 ${plan.days} 天 · ${plan.status}`;
      item.append(link, meta);
      return item;
    }));
    loadRead();
    if (dialog.open) markRead();
    else showUnread();
  }
  root.querySelector('[data-notification-open]')!.addEventListener('click', () => { dialog.showModal(); menu.open = false; markRead(); });
  root.querySelector('[data-notification-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => menu.querySelector('summary')!.focus());
  document.addEventListener('click', event => { if (event.target instanceof Node && !root.contains(event.target)) menu.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') menu.open = false; });
  window.addEventListener('universe:news-read', update);
  window.addEventListener('storage', event => { if (event.key === newsReadKey) { update(); return; } if (event.key === key || event.key === null) { read.clear(); update(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  window.setInterval(update, 60000);
  update();
}
