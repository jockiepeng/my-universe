import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function selectMoments(comments, owner) {
  return comments.filter(c => c.author?.login?.toLowerCase() === owner.toLowerCase())
    .sort ( (a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, body, bodyHTML, createdAt, updatedAt, url, author, replies }) => ({ id, body, bodyHTML, createdAt, updatedAt, url, author, replies: replies?.nodes || [] }));
}

export async function fetchMoments({ token, repo, number, owner, fetcher = fetch }) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^\d+$/.test(String(number || '')) || !owner) throw new Error('动态同步配置不完整');
  const [repositoryOwner, name] = repo.split('/');
  const query = `query($owner:String!,$name:String!,$number:Int!,$cursor:String) {
    repository(owner:$owner,name:$name) { discussion(number:$number) { comments(first:100,after:$cursor) {
      nodes { id body bodyHTML createdAt updatedAt url author { login avatarUrl } replies(first:30) { nodes { id bodyHTML createdAt url author { login avatarUrl } } pageInfo { hasNextPage endCursor } } }
      pageInfo { hasNextPage endCursor }
    } } } }`;
  let cursor = null;
  const comments = [];
  do {
    const response = await fetcher('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'my-universe-moments' }, body: JSON.stringify({ query, variables: { owner: repositoryOwner, name, number: Number(number), cursor } }) });
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
    const result = await response.json();
    if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
    const page = result.data?.repository?.discussion?.comments;
    if (!page || !Array.isArray(page.nodes) || !page.pageInfo) throw new Error('找不到动态 Discussion');
    comments.push(...page.nodes);
    if (page.pageInfo.hasNextPage && (!page.pageInfo.endCursor || page.pageInfo.endCursor === cursor)) throw new Error('GitHub 分页游标无效');
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  const moments = selectMoments(comments, owner);
  for (const moment of moments) {
    const source = comments.find(comment => comment.id === moment.id);
    let page = source?.replies?.pageInfo;
    let previous = null;
    while (page?.hasNextPage) {
      if (!page.endCursor || page.endCursor === previous) throw new Error('GitHub reply cursor invalid');
      previous = page.endCursor;
      const query = `query($id:ID!,$cursor:String) { node(id:$id) { ... on DiscussionComment { replies(first:100,after:$cursor) { nodes { id bodyHTML createdAt url author { login avatarUrl } } pageInfo { hasNextPage endCursor } } } } }`;
      const response = await fetcher('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'my-universe-moments' }, body: JSON.stringify({ query, variables: { id: moment.id, cursor: previous } }) });
      if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
      const result = await response.json();
      if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
      const replies = result.data?.node?.replies;
      if (!replies || !Array.isArray(replies.nodes) || !replies.pageInfo) throw new Error('GitHub replies unavailable');
      moment.replies.push(...replies.nodes);
      page = replies.pageInfo;
    }
  }
  return { updatedAt: new Date().toISOString(), moments };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const data = await fetchMoments({ token: process.env.GITHUB_TOKEN, repo: process.env.MOMENTS_REPO, number: process.env.MOMENTS_DISCUSSION_NUMBER, owner: process.env.MOMENTS_AUTHOR });
    await writeFile('src/data/moments.json', JSON.stringify(data, null, 2) + '\n');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
