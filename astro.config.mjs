import { defineConfig } from 'astro/config';
import { normalizeBase } from './src/lib/paths.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://jockiepeng.github.io',
  base: normalizeBase(process.env.BASE_PATH ?? '/my-universe') || '/',
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: true },
  },
  devToolbar: { enabled: false },
});
