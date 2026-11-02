import { normalizeAppearance } from '../lib/appearance.mjs';
import { resolveMotion, scenePresets } from '../lib/motion.mjs';

const root = document.documentElement;
const storageKey = 'little-universe-appearance-v1';
let appearance = normalizeAppearance(null);
try { appearance = normalizeAppearance(JSON.parse(localStorage.getItem(storageKey) || 'null')); } catch { /* Optional storage. */ }
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const trigger = document.querySelector<HTMLButtonElement>('[data-scene-toggle]');
const picker = document.querySelector<HTMLElement>('#scene-picker');
let midnight: ReturnType<typeof setTimeout>;

function render() {
  clearTimeout(midnight);
  const motion = resolveMotion(appearance);
  root.dataset.scene = motion.scene; root.dataset.opening = motion.opening;
  root.dataset.sceneMode = motion.sceneMode; root.dataset.motionDay = motion.dateKey;
  root.dataset.theme = appearance.theme;
  root.style.colorScheme = appearance.theme === 'auto' ? 'light dark' : appearance.theme;
  const scene = scenePresets.find(scene => scene.id === motion.scene)!;
  const label = document.querySelector('[data-scene-label]'); if (label) label.textContent = scene.shortName;
  trigger?.setAttribute('aria-label', `切换背景，当前为${scene.name}`);
  document.querySelectorAll<HTMLButtonElement>('[data-scene-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sceneOption === motion.scene)));
  document.querySelectorAll<HTMLButtonElement>('[data-opening-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.openingOption === motion.opening)));
  document.querySelector('[data-motion-daily]')?.setAttribute('aria-pressed', String(motion.sceneMode === 'daily' && motion.openingMode === 'daily'));
  const status = document.querySelector('[data-scene-status]');
  if (status) status.textContent = motion.sceneMode === 'daily' && motion.openingMode === 'daily' ? `今日按日期尾号 ${motion.tail} 自动选择` : '当前使用手动选择，明天恢复自动';
  const dark = appearance.theme === 'dark' || (appearance.theme === 'auto' && systemTheme.matches);
  document.querySelector('[data-theme-toggle]')?.setAttribute('aria-label', dark ? '切换为浅色主题' : '切换为深色主题');
  const enabled = appearance.motion && !reduced.matches;
  root.dataset.motion = enabled ? 'on' : 'off'; root.classList.toggle('u-paused', !enabled || document.hidden);
  const motionButton = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  if (motionButton) {
    motionButton.setAttribute('aria-pressed', String(enabled)); motionButton.disabled = reduced.matches;
    motionButton.title = reduced.matches ? '系统已启用减少动态效果' : '开启或关闭背景动态';
  }
  const motionLabel = document.querySelector('[data-motion-label]'); if (motionLabel) motionLabel.textContent = `背景动态：${enabled ? '开' : '关'}`;
  window.dispatchEvent(new CustomEvent('universe:appearance', { detail: { ...motion, theme: dark ? 'dark' : 'light', motion: enabled } }));
  if (!document.hidden) {
    const next = new Date(`${motion.dateKey}T00:00:00+08:00`).getTime() + 86400000;
    midnight = setTimeout(render, Math.max(100, next - Date.now() + 30));
  }
}
function save() { try { localStorage.setItem(storageKey, JSON.stringify(appearance)); } catch { /* Continue without persistence. */ } }
function setPicker(open: boolean, restoreFocus = false) {
  if (picker) picker.hidden = !open; trigger?.setAttribute('aria-expanded', String(open)); if (restoreFocus) trigger?.focus();
}
function select(type: 'scene' | 'opening', value: string) {
  const current = resolveMotion(appearance);
  if (appearance.selectionDate !== current.dateKey) appearance = normalizeAppearance({ ...appearance, scene: 'daily', opening: 'daily' });
  appearance = normalizeAppearance({ ...appearance, [type]: value, selectionDate: current.dateKey }); render(); save();
}
trigger?.addEventListener('click', () => setPicker(picker?.hasAttribute('hidden') ?? false));
document.querySelectorAll<HTMLButtonElement>('[data-scene-option]').forEach(button => button.addEventListener('click', () => { select('scene', button.dataset.sceneOption!); setPicker(false, true); }));
document.querySelectorAll<HTMLButtonElement>('[data-opening-option]').forEach(button => button.addEventListener('click', () => select('opening', button.dataset.openingOption!)));
document.querySelector('[data-motion-daily]')?.addEventListener('click', () => { appearance = normalizeAppearance({ ...appearance, scene: 'daily', opening: 'daily', selectionDate: null }); render(); save(); });
document.querySelector('[data-intro-replay]')?.addEventListener('click', () => { setPicker(false); window.dispatchEvent(new Event('universe:replay-entry')); });
document.addEventListener('click', event => { if (event.target instanceof Element && !event.target.closest('.u-scene-control')) setPicker(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && picker && !picker.hidden) { event.preventDefault(); setPicker(false, true); } });
document.querySelector('.u-scene-control')?.addEventListener('focusout', event => {
  const next = (event as FocusEvent).relatedTarget;
  if (next instanceof Node && !document.querySelector('.u-scene-control')?.contains(next)) setPicker(false);
});
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const dark = appearance.theme === 'dark' || (appearance.theme === 'auto' && systemTheme.matches);
  appearance.theme = dark ? 'light' : 'dark'; render(); save();
});
document.querySelector('[data-motion-toggle]')?.addEventListener('click', () => { appearance.motion = !appearance.motion; render(); save(); });
systemTheme.addEventListener('change', render); reduced.addEventListener('change', render); document.addEventListener('visibilitychange', render);
window.addEventListener('pageshow', render); window.addEventListener('pagehide', () => clearTimeout(midnight));
window.addEventListener('storage', event => {
  if (event.key !== storageKey) return;
  try { appearance = normalizeAppearance(JSON.parse(event.newValue || 'null')); } catch { appearance = normalizeAppearance(null); } render();
});

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const posts = [...document.querySelectorAll<HTMLElement>('[data-post-list] [data-kind]')];
  posts.forEach(post => { post.hidden = filter !== 'all' && post.dataset.kind !== filter; });
  const empty = document.querySelector<HTMLElement>('[data-filter-empty]'); if (empty) empty.hidden = posts.some(post => !post.hidden);
}));
const toc = document.querySelector<HTMLDetailsElement>('.u-toc'); if (toc && matchMedia('(max-width:580px)').matches) toc.open = false;
render();
