/** Discussion news v1.1. Markdown is parsed into text, never rendered as HTML. */
export const newsReadKey = 'universe:news:read:v1';
export function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function beijingDay(now = new Date()) { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
function sourceLink(line, label) {
  const match = line.match(new RegExp(`^\\[${label}\\]\\((https?:\\/\\/[^\\s]+)\\)$`));
  if (!match) throw new Error(`缺少有效${label}链接`);
  const url = new URL(match[1]);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('无效来源链接');
  return url.href;
}
function nonempty(text) { if (!text.trim()) throw new Error('字段内容为空'); return text.trim(); }
function article(lines, number) {
  const title = lines.shift()?.match(/^## (\d+)\. (.+)$/);
  if (!title || Number(title[1]) !== number) throw new Error('新闻编号不连续');
  const body = lines.join('\n').trim();
  const fields = [...body.matchAll(/^\*\*(摘要|阅读价值|来源|摘要依据)：\*\*\s*/gm)];
  if (fields.map(x => x[1]).join(',') !== '摘要,阅读价值,来源,摘要依据' || fields[0]?.index !== 0) throw new Error('新闻字段格式不符');
  const linkStart = body.lastIndexOf('\n[阅读原文](');
  if (linkStart < fields[3].index) throw new Error('缺少阅读原文链接');
  const values = fields.map((f, i) => nonempty(body.slice(f.index + f[0].length, i < 3 ? fields[i + 1].index : linkStart)));
  if (values[2].includes('\n') || !['原文', 'RSS 摘要（未读取完整正文）'].includes(values[3])) throw new Error('来源或摘要依据格式不符');
  return { title: nonempty(title[2]), summary: values[0], value: values[1], source: values[2], basis: values[3], url: sourceLink(body.slice(linkStart).trim(), '阅读原文') };
}
export function parseNews(markdown) {
  if (typeof markdown !== 'string') throw new Error('日报正文无效');
  const lines = markdown.replace(/\r\n?/g, '\n').trim().split('\n');
  const heading = lines.shift()?.match(/^# (\d{4}-\d{2}-\d{2}) 每日新闻$/);
  if (!heading || !validDay(heading[1])) throw new Error('日报日期无效');
  const date = heading[1], articles = [], history = [];
  let block = [], historyMode = false, historySeen = false;
  function flush() {
    if (!block.some(line => line.trim())) { block = []; return; }
    if (!historyMode) articles.push(article(block, articles.length + 1));
    else {
      const head = block.shift()?.match(/^### (\d{4}-\d{2}-\d{2}) · (.+)$/);
      if (!head || !validDay(head[1]) || head[1].slice(5) !== date.slice(5) || head[1].slice(0, 4) >= date.slice(0, 4)) throw new Error('历史事件日期无效');
      const text = block.join('\n').trim(), start = text.lastIndexOf('\n[事件来源](');
      if (start < 0) throw new Error('缺少事件来源');
      history.push({ date: head[1], title: nonempty(head[2]), summary: nonempty(text.slice(0, start)), url: sourceLink(text.slice(start).trim(), '事件来源') });
    }
    block = [];
  }
  for (const line of lines) {
    if (line === '## 历史上的今天') {
      if (historySeen) throw new Error('重复历史章节');
      flush(); historyMode = historySeen = true;
    } else if (/^#{1,6} /.test(line)) {
      flush();
      if ((!historyMode && !/^## \d+\. .+$/.test(line)) || (historyMode && !/^### \d{4}-\d{2}-\d{2} · .+$/.test(line))) throw new Error('章节格式不符');
      block.push(line);
    } else if (block.length || line.trim()) block.push(line);
  }
  flush();
  if (!articles.length || (historySeen && !history.length)) throw new Error('日报或历史章节为空');
  return { date, articles, history };
}
export function collectNews(comments, owner, number = 9) {
  const dates = new Set();
  return comments.filter(c => c.author?.login?.toLowerCase() === owner.toLowerCase()).flatMap(c => {
    // Every allowed-author top-level comment is a report; malformed edits fail the entire sync.
    const parsed = parseNews(c.body);
    if (dates.has(parsed.date)) throw new Error(`重复日报日期：${parsed.date}`);
    dates.add(parsed.date);
    const url = new URL(c.url);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new Error('日报来源地址无效');
    return [{ ...parsed, id: `${number}:${parsed.date}`, commentId: c.id, url: url.href, updatedAt: c.updatedAt }];
  }).sort((a, b) => b.date.localeCompare(a.date));
}
export function recentNews(reports, read = new Set(), now = new Date()) {
  const today = beijingDay(now), end = Date.parse(`${today}T00:00:00Z`);
  return reports.filter(r => validDay(r.date) && !read.has(r.id) && Date.parse(`${r.date}T00:00:00Z`) <= end && Date.parse(`${r.date}T00:00:00Z`) >= end - 2 * 86400000).sort((a, b) => b.date.localeCompare(a.date));
}
