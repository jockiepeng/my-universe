import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMoments, fetchMoments } from '../scripts/sync-moments.mjs';

test('only owner comments are returned in reverse chronological order', () => {
  const comments = [
    { id: '1', author: { login: 'Owner' }, body: 'first', createdAt: '2025-01-01T00:00:00Z', url: 'https://github.com/x/y/discussions/1#discussioncomment-1' },
    { id: '2', author: { login: 'visitor' }, body: 'visitor', createdAt: '2025-01-03T00:00:00Z' },
    { id: '3', author: { login: 'owner' }, body: 'second', createdAt: '2025-01-02T00:00:00Z', url: 'https://github.com/x/y/discussions/1#discussioncomment-3' },
  ];
  assert.deepEqual(selectMoments(comments, 'owner').map(x => x.body), ['second', 'first']);
});


test('fetches all discussion pages and excludes visitors', async () => {
  const cursors = [];
  const fetcher = async (_url, request) => {
    const cursor = JSON.parse(request.body).variables.cursor;
    cursors.push(cursor);
    const comments = cursor === null
      ? { nodes: [{ id: '1', body: 'first', author: { login: 'owner' }, createdAt: '2025-01-01' }], pageInfo: { hasNextPage: true, endCursor: 'next' } }
      : { nodes: [{ id: '2', body: 'visitor', author: { login: 'visitor' }, createdAt: '2025-01-02' }], pageInfo: { hasNextPage: false, endCursor: null } };
    return { ok: true, json: async () => ({ data: { repository: { discussion: { comments } } } }) }; 
  };
  const result = await fetchMoments({ token: 'test', repo: 'owner/repo', number: '1', owner: 'owner', fetcher });
  assert.deepEqual(cursors, [null, 'next']);
  assert.deepEqual(result.moments.map(x => x.id), ['1']);
});

test('fails on GraphQL errors rather than replacing the snapshot', async () => {
  await assert.rejects(fetchMoments({ token: 'test', repo: 'owner/repo', number: '1', owner: 'owner', fetcher: async () => ({ ok: true, json: async () => ({ errors: [{ message: 'denied' }] }) }) }), /denied/);
});
