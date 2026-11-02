/** Validate the relationship between a post's type, gallery and cover. */
export function photoPostIssues(data) {
  const count = data.images?.length ?? 0;
  if (data.kind !== 'photo') return count ? [{ path: ['images'], message: '多图请使用 kind: photo；普通文章可在正文中插图。' }] : [];
  const issues = [];
  if (count < 1 || count > 9) issues.push({ path: ['images'], message: '贴图需要提供 1–9 张图片。' });
  if (data.cover) issues.push({ path: ['cover'], message: '贴图不使用 cover，请将所有图片放入 images。' });
  return issues;
}

/** Photo bodies are plain text; catch image markup rather than silently displaying it. */
export function validatePhotoBody(body = '', label = '贴图') {
  if (/!\[|<\s*\/?\s*(?:img|picture|svg|image)\b/i.test(body)) {
    throw new Error(`${label}：贴图正文只能写文字，请将图片放入 images 配置。`);
  }
}

