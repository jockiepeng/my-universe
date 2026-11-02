# 写作与发布

## 先写文稿

还没整理好的想法和初稿放在仓库根目录的 [`drafts/`](../drafts/README.md) 中，直接写 Markdown 正文即可，无需文章配置。这个文件夹不参与博客构建。

之后可以让 AI 根据指定文稿润色，在 `src/content/posts/` 中生成正式文章，先设为 `draft: true`，确认后再发布；原始文稿保留。

## 新建文章

在 `src/content/posts/` 新建 `.md` 文件，公开链接由 `slug` 决定。复制以下模板：

```yaml
---
title: 今天想记下的事
slug: something-to-remember
date: 2026-11-02T20:00:00+08:00
category: 日常
tags: [生活]
kind: post
summary: 一句简短介绍；这一项也可以省略。
draft: true
---
```

在 frontmatter 下写 Markdown 正文。准备发布时改为 `draft: false`，提交并推送到发布分支即可。`draft: true` 只在本地开发模式可见；正式构建、搜索、RSS、站点地图都不包含它。

- `slug`：必填，小写英文、数字和连接符，全站唯一。发布后保持稳定，例如 `/posts/something-to-remember/`。
- `date`：必填，建议写明 `+08:00` 时区；页面按上海时间显示。不支持定时发布。
- `category`：日常、随想、实践三选一；扩展时同步修改集合校验和分类配置。
- `tags`：可省略，支持中文；不使用 `/`、`\`、`?`、`#`、`%` 等路径保留字符。
- `kind`：`post` 为文章，`photo` 为贴图；省略时默认文章。仅支持这两种类型。
- `summary`：可省略，网站会从正文生成摘要。
- `comments`：可设 `true` 或 `false`；文章默认开启，贴图默认关闭；需全站完成 giscus 配置。
- `updated`：可选，格式与日期相同，在文章标题下显示更新时间。
- `cover`：普通文章可选，本地图片相对路径，例如 `./images/my-photo.jpg`；建议填写 `coverAlt` 描述图片。贴图统一使用 `images`，不设置 `cover`。
- `example`：现有样文使用 `true` 标为示例；自己的文章无需此字段。

## 贴图：上方多图，下方文字

设为 `kind: photo`，在 `images` 中按顺序列出 1–9 张图片，每张都填写 `src` 和图片说明 `alt`。首页、分类和标签等文章列表统一只显示标题、摘要等文字，不展示图片；首页可以单独筛选“贴图”。进入详情页后，头部一次展示一张图片，下方显示完整文字。

```markdown
---
title: 散步时看到的风景
slug: a-walk-in-the-evening
date: 2026-11-02T20:00:00+08:00
category: 日常
tags: [散步]
kind: photo
draft: true
images:
  - src: ./a-walk/01.jpg
    alt: 河边的夕阳
  - src: ./a-walk/02.jpg
    alt: 路边的一棵树
---

在这里写文字，换行会保留。
这一行仍在同一段里。

空一行开始新的段落。
```

多图支持左右滑动逐张查看；电脑还可使用上一张、下一张按钮，或聚焦图片区域后使用方向键、Home / End 切换。显示当前张数，不自动播放。图片保持比例完整展示，点击可在新标签页查看原图。禁用 JavaScript 时仍可横向滚动浏览。

贴图正文是纯文字，不解析 Markdown 或 HTML。不要在正文中写 `![图片](路径)` 或 `<img>` 等图片标记，构建时会提示改放到 `images` 中。普通文章仍可在正文中插图。

可以复制 [`drafts/贴图模板.md`](../drafts/贴图模板.md) 开始写，图片放在文稿旁的同名文件夹。让 AI 整理为正式贴图时，一起迁移图片并修正 `images` 相对路径，先保留 `draft: true`，确认后再发布。

## 图片、目录与代码

图片放在文章旁的 `images/` 文件夹，用相对路径插入：

```markdown
![对图片内容的描述](./images/my-photo.jpg)
```

`##` 和 `###` 标题自动生成目录，手机端默认收起。带语言名称的代码块自动高亮。长表格与代码块在手机上可横向滚动，正文保持在屏幕宽度内。

## 个性化

站名、描述和公开联系链接在 `src/site.config.ts`；自我介绍在 `src/pages/about.astro`。先替换示例介绍，将示例文章改为自己的内容或删除。

访客可切换深空与沙滩、深浅色和背景动态。偏好保存在当前浏览器，不修改仓库，也不需要登录。

## 发布前

运行 `npm run verify`。确认私密内容没有误设为 `draft: false`，图片和链接正确；随后提交到 GitHub。Pages 工作流发布后，检查实际域名上的搜索、阅读量与评论。
