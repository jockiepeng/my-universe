export function filterTips(tips, query = '') {
  const term = query.trim().toLocaleLowerCase();
  return tips.filter(tip => String(tip.body || '').toLocaleLowerCase().includes(term));
}
