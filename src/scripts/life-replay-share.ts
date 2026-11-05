import { formatDay } from '../lib/life-grid.mjs';
import { DEFAULT_WISH, normalizeWish, graphemes, visibleLength } from '../lib/life-journey.mjs';
import { totalCells, wrapCanvasText, type Life, type Unit } from '../lib/life-painter';
import { LifeLightMap, LIGHT_COLORS } from '../lib/life-light-map';
import { t, getLanguage } from '../lib/i18n.mjs';

type Snapshot = { life: Life; unit: Unit; birth: string; years: number; example: boolean };
const font = '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
async function createPoster(snapshot: Snapshot, wish: string, includeBirth: boolean) {
  const { life, unit, example, years, birth } = snapshot;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2400;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('当前浏览器无法生成图片。'));
  const color = LIGHT_COLORS;
  ctx.fillStyle = color.background; ctx.fillRect(0, 0, 1600, 2400);
  ctx.textAlign = 'center'; ctx.fillStyle = color.muted; ctx.font = `26px ${font}`;
  ctx.fillText(t(`${example ? '示例人生 · ' : ''}假设这一生，走到 ${years} 岁`), 800, 118, 1350);
  ctx.fillStyle = color.text; ctx.font = `600 66px ${font}`;
  ctx.fillText(t(`一生不过 ${life.totalDays.toLocaleString('en-US')} 天。`), 800, 210, 1350);
  ctx.fillStyle = color.muted; ctx.font = `24px ${font}`;
  ctx.fillText(t(`一格一${unit === 'day' ? '天' : '周'}，共 ${totalCells(life, unit).toLocaleString('en-US')} 格。每个日夜，都不可重复。`), 800, 265, 1350);
  const map = new LifeLightMap(life, unit, 1320, 1390);
  map.paint(ctx, { x: 180, y: 330, width: 1320, height: 1390 }, life.elapsedDays, { labelScale: 2.1 });
  ctx.textAlign = 'center'; ctx.fillStyle = color.text; ctx.font = `600 44px ${font}`;
  ctx.fillText(t('原来，我已经走过这么远了。'), 800, 1810, 1350);
  ctx.fillStyle = color.muted; ctx.font = `25px ${font}`;
  const progress = life.remainingDays ? Math.min(99.9, life.elapsedDays / life.totalDays * 100) : 100;
  ctx.fillText(t(`已走过 ${life.elapsedDays.toLocaleString('en-US')} 天   /   ${progress.toFixed(1)}%   /   按设定尚有 ${life.remainingDays.toLocaleString('en-US')} 天`), 800, 1870, 1350);
  ctx.font = `24px ${font}`;
  ctx.fillText(t('珍惜时间，热爱生活。'), 800, 1950, 1350);
  ctx.fillText(t('剩下的格子，还等着你填写。'), 800, 2000, 1350);
  let wishSize = 34;
  ctx.font = `${wishSize}px ${font}`; ctx.fillStyle = color.text;
  let lines = wrapCanvasText(ctx, wish, 1260);
  while (lines.length * wishSize * 1.6 > 160 && wishSize > 14) {
    wishSize -= 2; ctx.font = `${wishSize}px ${font}`;
    lines = wrapCanvasText(ctx, wish, 1260);
  }
  lines.forEach((line, i) => ctx.fillText(line, 800, 2080 + i * wishSize * 1.6));
  ctx.fillStyle = color.muted; ctx.font = `19px ${font}`;
  const date = formatDay(life.todayDay);
  ctx.fillText(`${includeBirth ? `${t(`出生日期 ${birth}`)} · ` : ''}${t(`生成于 ${date} · 按个人设定寿命计算，并非预测`)}`, 800, 2275, 1350);
  ctx.fillText(t('jockie的小宇宙 · 时光回放'), 800, 2310, 1350);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(t('图片生成失败，请重试。'))), 'image/png'));
}

export function setupReplayShare(root: HTMLElement, getSnapshot: () => Snapshot) {
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const dialog = get<HTMLDialogElement>('[data-life-share-dialog]');
  const wish = get<HTMLTextAreaElement>('[data-life-wish]');
  const includeBirth = get<HTMLInputElement>('[data-life-include-birth]');
  const image = get<HTMLImageElement>('[data-life-poster]');
  const download = get<HTMLButtonElement>('[data-life-download]'), share = get<HTMLButtonElement>('[data-life-native-share]');
  const status = get('[data-life-share-status]');
  const summary = get('[data-life-poster-summary]');
  // The translated caption includes a user-authored wish; never translate that text.
  summary.setAttribute('data-i18n-skip', '');
  let url = '', blob: Blob | null = null, revision = 0, timer = 0, sharing = false;
  const filename = () => getLanguage() === 'en' ? `life-replay-${getSnapshot().unit}-${formatDay(getSnapshot().life.todayDay)}.png` : `人生长卷-${getSnapshot().unit === 'day' ? '日' : '周'}-${formatDay(getSnapshot().life.todayDay)}.png`;
  function release() { if (url) URL.revokeObjectURL(url); url = ''; blob = null; image.removeAttribute('src'); get('[data-life-image-link]').removeAttribute('href'); }
  function pending() {
    revision++; blob = null;
    dialog.dataset.ready = 'false'; download.disabled = share.disabled = true;
    image.removeAttribute('src'); get('[data-life-image-link]').removeAttribute('href');
    get('[data-life-poster-summary]').textContent = '';
    status.textContent = '正在绘制你的长卷…';
  }
  async function generate() {
    window.clearTimeout(timer); if (!dialog.open) return;
    pending(); const token = revision;
    const snapshot = getSnapshot(), text = wish.value.trim() ? normalizeWish(wish.value) : t(DEFAULT_WISH), showBirth = includeBirth.checked;
    try {
      const next = await createPoster(snapshot, text, showBirth);
      if (token !== revision || !dialog.open) return;
      release(); blob = next; url = URL.createObjectURL(next);
      image.src = url; image.alt = `一生不过 ${snapshot.life.totalDays.toLocaleString('en-US')} 天。珍惜时间，热爱生活。完整人生格子与未来寄语分享图。`; get<HTMLAnchorElement>('[data-life-image-link]').href = url;
      await image.decode();
      if (token !== revision || !dialog.open) return;
      summary.textContent = `${t(`${snapshot.example ? '示例人生' : '你的人生'} · 共 ${totalCells(snapshot.life, snapshot.unit).toLocaleString('en-US')} 格`)} · ${showBirth ? `${t(`出生日期 ${snapshot.birth}`)} · ` : ''}${text}`;
      const file = new File([next], filename(), { type: 'image/png' });
      let native = false;
      try { native = typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] }); } catch { /* Download remains available. */ }
      share.hidden = !native; download.disabled = share.disabled = false;
      dialog.dataset.ready = 'true'; status.textContent = '完整长卷已生成。保存图片，或打开图片后长按保存。';
    } catch (error) {
      if (token !== revision || !dialog.open) return;
      status.textContent = error instanceof Error ? error.message : '图片暂时无法生成，请关闭后重试。';
    }
  }
  function schedule() {
    window.clearTimeout(timer);
    if (dialog.open) { pending(); timer = window.setTimeout(generate, 180); }
  }
  function updateWish() {
    if (visibleLength(wish.value) > 80) wish.value = graphemes(wish.value).slice(0, 80).join('');
    get('[data-life-wish-count]').textContent = `${visibleLength(wish.value)} / 80`;
    root.querySelectorAll<HTMLButtonElement>('[data-life-idea]').forEach(button => button.setAttribute('aria-pressed', String(t(button.dataset.lifeIdea || '') === wish.value)));
    schedule();
  }
  wish.placeholder = t(DEFAULT_WISH);
  wish.addEventListener('input', event => { if (!(event instanceof InputEvent) || !event.isComposing) updateWish(); });
  wish.addEventListener('compositionend', updateWish);
  root.querySelectorAll<HTMLButtonElement>('[data-life-idea]').forEach(button => button.addEventListener('click', () => { wish.value = t(button.dataset.lifeIdea || ''); updateWish(); }));
  get('[data-life-share-open]').addEventListener('click', () => { dialog.showModal(); void generate(); });
  get('[data-life-share-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { revision++; window.clearTimeout(timer); release(); get<HTMLButtonElement>('[data-life-share-open]').focus({ preventScroll: true }); });
  includeBirth.addEventListener('change', () => void generate());
  root.addEventListener('lifechange', schedule);
  document.addEventListener('universe:language', () => {
    wish.placeholder = t(DEFAULT_WISH);
    root.querySelectorAll<HTMLButtonElement>('[data-life-idea]').forEach(button => button.setAttribute('aria-pressed', String(t(button.dataset.lifeIdea || '') === wish.value)));
    schedule();
  });
  download.addEventListener('click', () => {
    if (!blob || !url) return;
    const link = document.createElement('a'); link.href = url; link.download = filename(); link.click();
  });
  share.addEventListener('click', async () => {
    if (!blob || sharing) return;
    sharing = true; share.disabled = true;
    try {
      await navigator.share({ files: [new File([blob], filename(), { type: 'image/png' })] });
      status.textContent = '已打开系统分享。';
    } catch (error) {
      status.textContent = error instanceof DOMException && error.name === 'AbortError' ? '已取消分享，图片仍在这里，可以随时保存。' : '系统分享暂不可用，可以使用「保存图片」。';
    } finally { sharing = false; share.disabled = !blob; }
  });
}
