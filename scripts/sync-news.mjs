import { writeFile, rename, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { collectNews } from '../src/lib/news.mjs';

export async function fetchNews({ token, repo, number = 9, owner, fetcher = fetch }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^[1-9]\d*$/.test(String(number)) || !owner) throw new Error('新闻同步配置不完整');
  const [repositoryOwner, name] = repo.split('/');
  const query = `query($owner:String!,$name:String!,$number:Int!,$cursor:String) { repository(owner:$owner,name:$name) { discussion(number:$number) { comments(first:100,after:$cursor) { nodes { id body updatedAt url author { login } } pageInfo { hasNextPage endCursor } } } } }`;
  const comments = [], cursors = new Set();
  let cursor = null;
  do {
    const response = await fetcher('https://api.github.com/graphql', { method: 'POST', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'my-universe-news' }, body: JSON.stringify({ query, variables: { owner: repositoryOwner, name, number: Number(number), cursor } }) });
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
    const result = await response.json();
    if (result.errors?.length) throw new Error('GitHub 新闻查询失败');
    const page = result.data?.repository?.discussion?.comments;
    if (!page || !Array.isArray(page.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw new Error('新闻 Discussion 数据不完整');
    comments.push(...page.nodes);
    if (page.pageInfo.hasNextPage && (!page.pageInfo.endCursor || cursors.has(page.pageInfo.endCursor))) throw new Error('新闻分页游标无效');
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return { updatedAt: new Date().toISOString(), reports: collectNews(comments, owner, number) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = 'src/data/news.json', temp = `${file}.tmp`;
  const statusFile = 'src/data/news-sync.json';
  async function recordStatus(status) {
    await writeFile(`${statusFile}.tmp`, JSON.stringify({status, attemptedAt: new Date().toISOString()}, null, 2) + '\n');
    await rename(`${statusFile}.tmp`, statusFile);
  }
  try {
    const data = await fetchNews({ token: process.env.GITHUB_TOKEN, repo: process.env.NEWS_REPO || 'jockiepeng/my-universe', number: process.env.NEWS_DISCUSSION_NUMBER || 9, owner: process.env.NEWS_AUTHOR || 'jockiepeng' });
    await writeFile(temp, JSON.stringify(data, null, 2) + '\n');
    await rename(temp, file);
    await recordStatus('success');
    console.log(`新闻同步成功：${data.reports.length} 期日报。`);
  } catch (error) {
    await unlink(temp).catch(() => {});
    await recordStatus('failed').catch(() => {});
    console.error(`新闻同步失败，保留上次有效快照：${error.message}`);
    process.exitCode = 1;
  }
}
