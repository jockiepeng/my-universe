import quotes from '../data/daily-quotes.json';
import { getDailyQuote } from '../lib/daily-quote.mjs';

const section = document.querySelector<HTMLElement>('[data-daily-quote]');
if (section) {
  let lastDate = '';
  let timer: ReturnType<typeof setTimeout>;
  function update() {
    clearTimeout(timer);
    const result = getDailyQuote(quotes);
    if (lastDate !== result.dateKey) {
      const quote = result.quote;
      const get = <T extends HTMLElement = HTMLElement>(selector: string) => section!.querySelector<T>(selector)!;
      const hasTranslation = Boolean(quote?.original && !(quote.originalLanguage || 'zh').startsWith('zh') && quote.original !== quote.text);
      get('[data-quote-text]').textContent = hasTranslation ? `${quote.original}（${quote.text}）` : quote?.text || '留一点空白，等待下一段话。';
      get('[data-quote-author]').textContent = quote?.author || '';
      get('[data-quote-work]').textContent = quote?.source || '';
      get('[data-quote-attribution]').hidden = !quote;
      section!.dataset.quoteDay = result.dateKey;
      section!.dataset.quoteId = result.quote?.id || '';
      lastDate = result.dateKey;
    }
    // The next Shanghai midnight is 16:00 UTC. One timer, no per-second work.
    const now = new Date();
    const midnight = new Date(`${result.dateKey}T00:00:00+08:00`).getTime() + 86400000;
    if (!document.hidden) timer = setTimeout(update, Math.max(100, midnight - now.getTime() + 30));
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pageshow', update);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  update();
}
