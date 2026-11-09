import { writeFile } from 'node:fs/promises';
import { fetchMoments } from './sync-moments.mjs';
try {
  const data = await fetchMoments({ token: process.env.GITHUB_TOKEN, repo: process.env.MOMENTS_REPO, number: process.env.PLANS_DISCUSSION_NUMBER, owner: process.env.MOMENTS_AUTHOR });
  await writeFile('src/data/plans.json', JSON.stringify(data, null, 2) + '\n');
} catch (error) { console.error(error.message); process.exitCode = 1; }
