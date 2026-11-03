import { formatDay } from '../lib/life-grid.mjs';
import { DEFAULT_WISH, normalizeWish, graphemes, visibleLength } from '../lib/life-journey.mjs';
import { paintLifeGrid, totalCells, completedCells, wrapCanvasText, type Life, type Unit } from '../lib/life-painter';

type Snapshot = { life: Life; unit: Unit; birth: string; years: number; example: boolean };
const font = '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
async function createPoster(snapshot: Snapshot, wish: string, includeBirth: boolean) {
  const { life, unit, example, years, birth } = snapshot;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2400;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法生成图片。');
  const color = { text: 'rgb(37, 43, 45)', muted: '#737975', future: '#d0d3ce', today: '#b18439', trail: '#303638' };
  ctx.fillStyle = '#fafaf7'; ctx.fillRect(0, 0, 1600, 2400);
  ctx.fillStyle = color.muted; ctx.font = `26px ${font}`;
  ctx.fillText(`${example ? '示例人生' : '我的人生长卷'} · 一格一${unit === 'day' ? '天' : '周'} · 设定 ${years} 岁`, 125, 140);
  ctx.font = '45px "Songti SC","SimSun",serif'; ctx.fillStyle = color.text;
  ctx.fillText('原来，已经走过了', 125, 247);
  const elapsed = completedCells(life, unit).toLocaleString('en-US');
  ctx.font = `500 154px ${font}`;
  ctx.fillText(elapsed, 115, 411);
  const numberWidth = ctx.measureText(elapsed).width;
  ctx.font = `40px ${font}`; ctx.fillText(unit === 'day' ? '天' : '周', 140 + numberWidth, 405);
  ctx.font = `24px ${font}`; ctx.fillStyle = color.muted;
  ctx.fillText('深色的每一格，都已成为过去。', 125, 475);
  const grid = paintLifeGrid(ctx, life, unit, { x: 245, y: 550, width: 1130, height: 1330 }, color, { labelScale: 2, monochrome: true });
  const index = Math.min(completedCells(life, unit), totalCells(life, unit) - 1);
  const row = Math.floor(index / grid.columns);
  const todayY = grid.y + row * grid.pitch + grid.size / 2;
  ctx.fillStyle = color.today; ctx.font = `21px ${font}`;
  if (life.remainingDays) ctx.fillText('今天', 1400, Math.min(1880, todayY + 7));
  ctx.fillStyle = color.muted; ctx.font = `22px ${font}`;
  const progress = life.remainingDays ? Math.min(99.9, life.elapsedDays / life.totalDays * 100) : 100;
  ctx.fillText(`共 ${totalCells(life, unit).toLocaleString('en-US')} 格 · 已走过 ${progress.toFixed(1)}%`, 125, 1940);
  ctx.textAlign = 'right';
  ctx.fillText(`按设定，尚有 ${(totalCells(life, unit) - completedCells(life, unit)).toLocaleString('en-US')} ${unit === 'day' ? '天' : '周'}`, 1475, 1940);
  ctx.textAlign = 'left';
  let wishSize = 36;
  ctx.font = `${wishSize}px "Songti SC","SimSun",serif`; ctx.fillStyle = color.text;
  let lines = wrapCanvasText(ctx, wish, 1310);
  while (lines.length * wishSize * 1.6 > 220 && wishSize > 14) {
    wishSize -= 2; ctx.font = `${wishSize}px "Songti SC","SimSun",serif`;
    lines = wrapCanvasText(ctx, wish, 1310);
  }
  lines.forEach((line, i) => ctx.fillText(line, 125, 2015 + i * wishSize * 1.6));
  ctx.fillStyle = color.muted; ctx.font = `19px ${font}`;
  const date = formatDay(life.todayDay);
  ctx.fillText(`${includeBirth ? `出生日期 ${birth} · ` : ''}生成于 ${date} · 按个人设定寿命计算，并非预测`, 125, 2275);
  ctx.fillText('jockie的小宇宙 · 人生格子', 125, 2310);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败，请重试。')), 'image/png'));
}

export function setupLifeShare(root: HTMLElement, getSnapshot: () => Snapshot) {
  const get = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const dialog = get<HTMLDialogElement>('[data-life-share-dialog]');
  const wish = get<HTMLTextAreaElement>('[data-life-wish]');
  const includeBirth = get<HTMLInputElement>('[data-life-include-birth]');
  const image = get<HTMLImageElement>('[data-life-poster]');
  const download = get<HTMLButtonElement>('[data-life-download]'), share = get<HTMLButtonElement>('[data-life-native-share]');
  const status = get('[data-life-share-status]');
  let url = '', blob: Blob | null = null, revision = 0, timer = 0, sharing = false;
  const filename = () => `人生长卷-${getSnapshot().unit === 'day' ? '日' : '周'}-${formatDay(getSnapshot().life.todayDay)}.png`;
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
    const snapshot = getSnapshot(), text = normalizeWish(wish.value), showBirth = includeBirth.checked;
    try {
      const next = await createPoster(snapshot, text, showBirth);
      if (token !== revision || !dialog.open) return;
      release(); blob = next; url = URL.createObjectURL(next);
      image.src = url; get<HTMLAnchorElement>('[data-life-image-link]').href = url;
      await image.decode();
      if (token !== revision || !dialog.open) return;
      get('[data-life-poster-summary]').textContent = `${snapshot.example ? '示例人生' : '你的人生'} · 共 ${totalCells(snapshot.life, snapshot.unit).toLocaleString('en-US')} 格 · ${showBirth ? `出生日期 ${snapshot.birth} · ` : ''}${text}`;
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
    root.querySelectorAll<HTMLButtonElement>('[data-life-idea]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lifeIdea === wish.value)));
    schedule();
  }
  wish.placeholder = DEFAULT_WISH;
  wish.addEventListener('input', event => { if (!(event instanceof InputEvent) || !event.isComposing) updateWish(); });
  wish.addEventListener('compositionend', updateWish);
  root.querySelectorAll<HTMLButtonElement>('[data-life-idea]').forEach(button => button.addEventListener('click', () => { wish.value = button.dataset.lifeIdea || ''; updateWish(); }));
  get('[data-life-share-open]').addEventListener('click', () => { dialog.showModal(); void generate(); });
  get('[data-life-share-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { revision++; window.clearTimeout(timer); release(); get<HTMLButtonElement>('[data-life-share-open]').focus({ preventScroll: true }); });
  includeBirth.addEventListener('change', () => void generate());
  root.addEventListener('lifechange', schedule);
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
