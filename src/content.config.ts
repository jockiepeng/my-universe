import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { photoPostIssues } from './lib/photo-posts.mjs';
import { publishedLoader } from './lib/published-loader.mjs';

const posts = defineCollection({
  loader: publishedLoader(glob({
    pattern: '**/*.md', base: './src/content/posts',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }), import.meta.env.DEV),
  schema: ({ image }) => z.object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 使用小写英文、数字与连接符'),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(['日常', '随想', '实践']),
    tags: z.array(z.string().trim().min(1).regex(/^[^/\\?#%]+$/, '标签不包含 URL 路径保留字符')).default([]),
    kind: z.enum(['post', 'photo']).default('post'),
    summary: z.string().optional(),
    draft: z.boolean().default(false),
    comments: z.boolean().optional(),
    example: z.boolean().default(false),
    cover: image().optional(),
    coverAlt: z.string().optional(),
    images: z.array(z.object({
      src: image(),
      alt: z.string().trim().min(1, '请为每张贴图填写图片说明 alt。'),
    })).default([]),
  }).superRefine((data, context) => {
    for (const issue of photoPostIssues(data)) context.addIssue({ code: 'custom', ...issue });
  }),
});

export const collections = { posts };
