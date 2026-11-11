import assert from 'node:assert/strict';
export function assertPostListed(relativeFile, base, listings, archive) {
  const target = `${base}/${relativeFile.replace(/index\.html$/, '')}`;
  const hasLink = html => [...html.matchAll(/href="([^"]+)"/g)].some(([, raw]) => {
    try { return decodeURIComponent(new URL(raw.replaceAll('&amp;', '&'), 'https://check.invalid').pathname) === decodeURIComponent(target); }
    catch { return false; }
  });
  assert.ok(listings.some(hasLink), `正式文章/贴图未进入首页分页：${relativeFile}`);
  assert.ok(hasLink(archive), `正式文章/贴图未进入归档：${relativeFile}`);
}
