import { beijingDay } from '../lib/news.mjs';
import { markNewsRead } from '../lib/news-read.mjs';
const edition = document.querySelector<HTMLElement>('[data-news-report]');
function readCurrent() {
  if (!document.hidden && edition?.dataset.newsReport && edition.querySelector('.news-card')) {
    markNewsRead(edition.dataset.newsReport);
    window.dispatchEvent(new Event('universe:news-read'));
  }
}
function status() {
  const el = document.querySelector<HTMLElement>('[data-news-status]');
  if (!el) return;
  const today = beijingDay();
  if (el.dataset.syncFailed === 'true') {
    el.textContent = el.dataset.latestDate ? '本次日报同步失败，正在显示上次成功同步的内容。' : '日报同步暂时失败，请稍后再来或查看 GitHub 来源。';
    return;
  }
  if (!el.dataset.latestDate) { el.textContent = '尚无已同步日报，请稍后再来。'; return; }
  el.textContent = el.dataset.latestDate === today ? '今日新闻已更新。' : '今日新闻尚未同步，已有日报可继续阅读。';
}
readCurrent(); status();
document.addEventListener('visibilitychange', () => { readCurrent(); status(); });
window.setInterval(status, 60000);
