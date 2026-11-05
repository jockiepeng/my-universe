/** @param {unknown} data */
export function formatVisitorLocation(data, language = 'zh') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = /** @type {Record<string, unknown>} */ (data);
  const code = record.country_code;
  if (record.error || typeof code !== 'string' || !/^[A-Z]{2}$/.test(code) || code === 'ZZ') return null;
  const country = new Intl.DisplayNames([language === 'en' ? 'en' : 'zh-CN'], { type: 'region', fallback: 'none' }).of(code);
  if (!country) return null;
  const regions = [record.region, record.city].filter(value =>
    typeof value === 'string' && value.trim().length <= 80 &&
    !/[<>\p{Cc}\p{Cf}]/u.test(value) && !/^(?:unknown|null|n\/a|-)?$/i.test(value.trim()),
  ).map(value => /** @type {string} */ (value).trim());
  return [...new Set([country, ...regions])].join(' · ');
}
