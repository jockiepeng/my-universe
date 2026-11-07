export const MOMENTS_PAGE_SIZE = 20;

export function buildMomentIndex(moments) {
  return moments.map((moment, position) => ({
    id: moment.id,
    createdAt: moment.createdAt,
    day: new Date(moment.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }),
    text: [moment.bodyText || moment.body || moment.bodyHTML, ...(moment.replies || []).map(reply => reply.bodyText || reply.bodyHTML)].join(' ').replace(/<[^>]*>/g, ' ').toLocaleLowerCase(),
    page: Math.floor(position / MOMENTS_PAGE_SIZE) + 1,
  }));
}

export function filterMomentIndex(index, { query = '', from = '', to = '', order = 'newest' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return index.filter(item => (!term || item.text.includes(term)) && (!from || item.day >= from) && (!to || item.day <= to))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) * (order === 'oldest' ? 1 : -1));
}
