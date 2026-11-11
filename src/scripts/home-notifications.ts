import { overduePlans } from '../lib/plan-notifications.mjs';

const root = document.querySelector<HTMLDetailsElement>('[data-home-notifications]');
if (root) {
  const key = 'universe:plan-notifications:read:v1';
  const moments = JSON.parse(root.dataset.plans || '[]');
  const list = root.querySelector<HTMLUListElement>('[data-notification-list]')!;
  const dot = root.querySelector<HTMLElement>('[data-notification-dot]')!;
  let read = new Set<string>();
  let ids: string[] = [];
  function loadRead() {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(stored)) read = new Set(stored.filter((id): id is string => typeof id === 'string'));
    } catch { /* Keep in-memory read state when storage is unavailable. */ }
  }
  function showUnread() { dot.hidden = !ids.some(id => !read.has(id)); }
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
    root.hidden = plans.length === 0;
    root.querySelector('[data-notification-count]')!.textContent = `（${plans.length}）`;
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
    if (root.open) markRead();
    else showUnread();
  }
  root.addEventListener('toggle', () => { if (root.open) markRead(); });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { read.clear(); loadRead(); showUnread(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  window.setInterval(update, 60000);
  update();
}
