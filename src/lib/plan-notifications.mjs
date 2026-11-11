import { parsePlan } from './plans.mjs';

export function overduePlans(moments, now = new Date()) {
  const today = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  return moments.flatMap(moment => {
    const plan = parsePlan(moment.body);
    if (!plan || plan.status === '已完成' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.date)) return [];
    const time = Date.parse(`${plan.date}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== plan.date || plan.date >= today) return [];
    return [{ ...plan, id: JSON.stringify([moment.url, plan.date]), days: Math.round((Date.parse(`${today}T00:00:00Z`) - time) / 86400000) }];
  }).sort((a, b) => a.date.localeCompare(b.date));
}
