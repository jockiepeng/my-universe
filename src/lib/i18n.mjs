import { messages as site } from '../i18n/site.mjs';
import { messages as games } from '../i18n/games.mjs';
import { messages as tools } from '../i18n/tools.mjs';

export const languageStorageKey = 'little-universe-language-v1';
export const messages = Object.freeze({ ...games, ...tools, ...site });
export const normalizeLanguage = value => value === 'en' ? 'en' : 'zh';
export const getLanguage = () => typeof document === 'undefined' ? 'zh' : normalizeLanguage(document.documentElement.dataset.language);

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(messages).filter(([key]) => /\{\d+\}/.test(key)).map(([source, target]) => {
  const indices = [];
  const parts = source.split(/(\{\d+\})/g);
  const expression = parts.map(part => {
    if (/^\{\d+\}$/.test(part)) { indices.push(Number(part.slice(1, -1))); return '([\\s\\S]+?)'; }
    return escape(part).replace(/\s+/g, '\\s+');
  }).join('');
  return { expression: new RegExp(`^${expression}$`), target, indices, specificity: source.replace(/\{\d+\}/g, '').length };
}).sort((a, b) => b.specificity - a.specificity);

/** Translate an entire UI message. Unknown prose is preserved, never word-replaced. */
export function translate(text, language = 'en', depth = 0) {
  if (language !== 'en' || typeof text !== 'string' || !text || depth > 8) return text;
  const source = text.trim();
  let result = Object.hasOwn(messages, source) ? messages[source] : undefined;
  if (result === undefined && /[\p{Script=Han}]/u.test(source)) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(source);
      if (!match) continue;
      const values = Object.fromEntries(pattern.indices.map((index, offset) => [index, translate(match[offset + 1], language, depth + 1)]));
      result = pattern.target.replace(/\{(\d+)\}/g, (_, index) => values[index] ?? '');
      break;
    }
  }
  if (result === undefined) return text;
  return text.slice(0, text.length - text.trimStart().length) + result + text.slice(text.trimEnd().length);
}

export const t = text => translate(text, getLanguage());
