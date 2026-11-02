import { getZonedClock } from './calendar.mjs';

export function getDailyQuote(quotes, now = new Date()) {
  const { dateKey } = getZonedClock(now);
  if (quotes.length === 0) return { dateKey, quote: null };
  // FNV-1a hashes the Shanghai date; a seeded Mulberry32 step mixes nearby dates.
  // No local storage: every reader gets the same choice for the same day/list.
  let seed = 2166136261;
  for (const char of dateKey) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  let value = seed + 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  const random = ((value ^ value >>> 14) >>> 0) / 4294967296;
  return { dateKey, quote: quotes[Math.floor(random * quotes.length)] };
}
