export function parsePlan(body) {
  const match = String(body || '').replace(/\r\n/g, '\n').trim().match(/^## 规划\n类型：([^\n]+)\n名称：([^\n]+)\n计划时间：([^\n]*)\n状态：(待开始|进行中|已完成)\n内容：(\n[\s\S]*)?$/);
  if (!match || !match[1].trim() || !match[2].trim()) return null;
  return { type: match[1].trim(), title: match[2].trim(), date: match[3].trim(), status: match[4], content: (match[5] || '').trim() };
}
export function formatPlan(plan) {
  const single = value => String(value || '').replace(/[\r\n]+/g, ' ').trim();
  return `## 规划\n类型：${single(plan.type)}\n名称：${single(plan.title)}\n计划时间：${single(plan.date)}\n状态：${single(plan.status)}\n内容：\n${String(plan.content || '').trim()}`;
}
