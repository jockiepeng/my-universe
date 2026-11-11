import { overduePlans } from '../lib/plan-notifications.mjs';

const root = document.querySelector<HTMLElement>('[data-home-notifications]');
if (root) {
  const key = 'universe:plan-notifications:read:v1';
  const moments = JSON.parse(root.dataset.plans || '[]');
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
  function showUnread() { dots.forEach(dot => { dot.hidden = !ids.some(id => !read.has(id)); }); }
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
    root.querySelector<HTMLElement>('[data-notification-empty]')!.hidden = plans.length > 0;
    root.querySelector<HTMLElement>('.notification-panel')!.hidden = plans.length === 0;
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
    if (dialog.open) markRead();
    else showUnread();
  }
  root.querySelector('[data-notification-open]')!.addEventListener('click', () => { dialog.showModal(); menu.open = false; markRead(); });
  root.querySelector('[data-notification-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => menu.querySelector('summary')!.focus());
  document.addEventListener('click', event => { if (event.target instanceof Node && !root.contains(event.target)) menu.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') menu.open = false; });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { read.clear(); loadRead(); showUnread(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  window.setInterval(update, 60000);
  update();
}
