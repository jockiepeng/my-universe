import { getZonedClock } from './calendar.mjs';

export function getDailyQuote(quotes, now = new Date()) {
  const { dateKey } = getZonedClock(now);
  const ids = new Set();
  for (const quote of quotes) {
    if (typeof quote.id !== 'string' || !quote.id.trim() || ids.has(quote.id)) {
      throw new TypeError('Each quote needs a unique, non-empty id.');
    }
    ids.add(quote.id);
    const start = quote.availableFrom;
    if (typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start)
      || !Number.isFinite(Date.parse(`${start}T00:00:00Z`))
      || new Date(`${start}T00:00:00Z`).toISOString().slice(0, 10) !== start) {
      throw new TypeError(`Quote ${quote.id} needs a valid availableFrom date (YYYY-MM-DD).`);
    }
  }
  // Future additions cannot change today's or historical choices. Sort by a
  // permanent ID so moving entries in the JSON file cannot change the choice.
  const eligible = quotes.filter(quote => quote.availableFrom <= dateKey)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (eligible.length === 0) return { dateKey, quote: null };
  // FNV-1a hashes the Shanghai date; a seeded Mulberry32 step mixes nearby dates.
  // No local storage: every reader gets the same choice for the same day/pool.
  let seed = 2166136261;
  for (const char of dateKey) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  let value = seed + 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  const random = ((value ^ value >>> 14) >>> 0) / 4294967296;
  return { dateKey, quote: eligible[Math.floor(random * eligible.length)] };
}
