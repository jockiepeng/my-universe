export const report = (date = '2026-11-12', title = '一条测试新闻') => `# ${date} 每日新闻

## 1. ${title}

**摘要：** 第一段摘要。

第二段摘要。

**阅读价值：** 了解这项变化。

**来源：** 示例媒体

**摘要依据：** RSS 摘要（未读取完整正文）

[阅读原文](https://example.org/news?q=1)

## 历史上的今天

### 1918-${date.slice(5)} · 一件历史事件

历史事件的摘要。

[事件来源](https://example.org/history)`;
export const comment = (date = '2026-11-12', overrides = {}) => ({ id: `comment-${date}`, body: report(date), createdAt: `${date}T00:40:00Z`, updatedAt: `${date}T00:40:00Z`, url: `https://github.com/jockiepeng/my-universe/discussions/9#discussioncomment-${date.replaceAll('-', '')}`, author: { login: 'jockiepeng' }, ...overrides });
