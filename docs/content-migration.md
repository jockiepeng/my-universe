# 原博客文章迁移

来源：[tcpjq/jockie_website](https://github.com/tcpjq/jockie_website/tree/84e19681f1c035c1bf472bf185dff6fca69baf77)，迁移时间：2026-11-02。仅复制内容，源仓库未作修改。

| 原文件（src/content/blog/） | 新文章路径（站点基础路径之后） | 状态 | 新分类 |
| --- | --- | --- | --- |
| ai-tools-setup.md | posts/ai-tools-setup/ | 公开 | 实践 |
| knowledge-base-practice.md | posts/knowledge-base-practice/ | 公开 | 实践 |
| hello-astro.md | 无 | 按用户要求移除 | — |
| reading-notes.md | 无 | 按用户要求移除 | — |
| draft-note.md | 无 | 按用户要求移除 | — |

最终仅保留前两篇文章，连同本项目原先的示例／草稿一并清理，归档、RSS 和搜索也只收录两篇。两篇文章的正文、标题、发布日期和标签保持原值。Frontmatter 的 `description/pubDate/updatedDate` 适配为 `summary/date/updated`，原文件名成为稳定 `slug`。`featured` 元数据保留在 Markdown 中，当前博客不使用置顶功能。“技术”分类映射为“实践”。

配图共 10 张，完整复制到 `src/content/posts/ai-tools-setup/`（2 张）和 `src/content/posts/knowledge-base-practice/`（8 张）。知识库文章中的 `/jockie_website/images/...` 改为相对本地图片路径，Astro 构建时生成带项目基础路径的静态资源，文章不依赖旧站图片链接。

原博客 `/blog/<slug>/` 地址仍属于旧站；新站使用 `/my-universe/posts/<slug>/`，本次未更改旧仓库或给旧站配置跳转。不蒜子历史 PV、旧仓库 Discussions／评论不属于 Markdown 内容，没有随文章迁移。
