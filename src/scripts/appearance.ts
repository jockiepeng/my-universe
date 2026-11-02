import { normalizeAppearance } from '../lib/appearance.mjs';

const root = document.documentElement;
const storageKey = 'little-universe-appearance-v1';
let appearance = normalizeAppearance(null);
try { appearance = normalizeAppearance(JSON.parse(localStorage.getItem(storageKey) || 'null')); } catch { /* Storage is optional. */ }
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const trigger = document.querySelector<HTMLButtonElement>('[data-scene-toggle]');
const picker = document.querySelector<HTMLElement>('#scene-picker');

function updateMotion() {
  const enabled = appearance.motion && !reduced.matches;
  root.dataset.motion = enabled ? 'on' : 'off';
  root.classList.toggle('u-paused', !enabled || document.hidden);
  const button = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  button?.setAttribute('aria-pressed', String(enabled));
  if (button) {
    button.disabled = reduced.matches;
    button.title = reduced.matches ? '系统已启用减少动态效果' : '开启或关闭背景动态';
  }
  const label = document.querySelector('[data-motion-label]');
  if (label) label.textContent = `背景动态：${enabled ? '开' : '关'}`;
}

function render() {
  root.dataset.scene = appearance.scene;
  root.dataset.theme = appearance.theme;
  root.style.colorScheme = appearance.theme === 'auto' ? 'light dark' : appearance.theme;
  const sceneName = appearance.scene === 'beach' ? '沙滩' : '深空';
  const label = document.querySelector('[data-scene-label]');
  if (label) label.textContent = sceneName;
  trigger?.setAttribute('aria-label', `切换背景，当前为${sceneName}`);
  document.querySelectorAll<HTMLButtonElement>('[data-scene-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sceneOption === appearance.scene)));
  const dark = appearance.theme === 'dark' || (appearance.theme === 'auto' && systemTheme.matches);
  document.querySelector('[data-theme-toggle]')?.setAttribute('aria-label', dark ? '切换为浅色主题' : '切换为深色主题');
  updateMotion();
  window.dispatchEvent(new CustomEvent('universe:appearance', { detail: { theme: dark ? 'dark' : 'light' } }));
}

function save() { try { localStorage.setItem(storageKey, JSON.stringify(appearance)); } catch { /* Continue without persistence. */ } }
function setPicker(open: boolean, restoreFocus = false) {
  if (picker) picker.hidden = !open;
  trigger?.setAttribute('aria-expanded', String(open));
  if (restoreFocus) trigger?.focus();
}

trigger?.addEventListener('click', () => setPicker(picker?.hasAttribute('hidden') ?? false));
document.querySelectorAll<HTMLButtonElement>('[data-scene-option]').forEach(button => button.addEventListener('click', () => {
  appearance = normalizeAppearance({ ...appearance, scene: button.dataset.sceneOption });
  render(); save(); setPicker(false, true);
}));
document.addEventListener('click', event => { if (event.target instanceof Element && !event.target.closest('.u-scene-control')) setPicker(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && picker && !picker.hidden) { event.preventDefault(); setPicker(false, true); } });
document.querySelector('.u-scene-control')?.addEventListener('focusout', event => {
  const next = (event as FocusEvent).relatedTarget;
  if (!(next instanceof Node) || !document.querySelector('.u-scene-control')?.contains(next)) setPicker(false);
});
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const dark = appearance.theme === 'dark' || (appearance.theme === 'auto' && systemTheme.matches);
  appearance.theme = dark ? 'light' : 'dark'; render(); save();
});
document.querySelector('[data-motion-toggle]')?.addEventListener('click', () => { appearance.motion = !appearance.motion; render(); save(); });
systemTheme.addEventListener('change', render);
reduced.addEventListener('change', updateMotion);
document.addEventListener('visibilitychange', updateMotion);
window.addEventListener('storage', event => {
  if (event.key !== storageKey) return;
  try { appearance = normalizeAppearance(JSON.parse(event.newValue || 'null')); } catch { appearance = normalizeAppearance(null); }
  render();
});

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const posts = [...document.querySelectorAll<HTMLElement>('[data-post-list] [data-kind]')];
  posts.forEach(post => { post.hidden = filter !== 'all' && post.dataset.kind !== filter; });
  const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
  if (empty) empty.hidden = posts.some(post => !post.hidden);
}));

const toc = document.querySelector<HTMLDetailsElement>('.u-toc');
if (toc && matchMedia('(max-width:580px)').matches) toc.open = false;
render();
