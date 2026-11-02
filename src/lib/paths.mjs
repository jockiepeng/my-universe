export function normalizeBase(base = '') {
  const clean = base.replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}` : '';
}

export function withBase(path = '/', base = '') {
  return `${normalizeBase(base)}/${path.replace(/^\/+/, '')}`;
}

export function absoluteUrl(path, site, base = '') {
  return new URL(withBase(path, base), site).href;
}
