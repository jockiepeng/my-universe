# 写作与发布

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
- `kind`：`post` 为长文，`note` 为短记；省略时默认长文。
- `summary`：可省略，网站会从正文生成摘要。
- `comments`：可设 `true` 或 `false`；长文默认开启，短记默认关闭；需全站完成 giscus 配置。
- `updated`：可选，格式与日期相同，在文章标题下显示更新时间。
- `cover`：可选，本地图片相对路径，例如 `./images/my-photo.jpg`；建议填写 `coverAlt` 描述图片。
- `example`：现有样文使用 `true` 标为示例；自己的文章无需此字段。

## 短记

设为 `kind: note` 即可。在首页直接展示一段正文，不必写成长篇；点击可进入详情，仍有自己的固定链接与阅读量。

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
