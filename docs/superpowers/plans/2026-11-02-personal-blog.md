# Personal Blog Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user has approved the design and requested coding in this session.

**Goal:** 将已认可的博客原型实现为可构建、可写作、可通过 GitHub Pages 发布的静态网站。

**Architecture:** Astro 静态输出和 Markdown 内容集合；原生浏览器脚本负责场景、主题与搜索，Pagefind 在构建后生成中文索引。giscus 通过公开配置接入，不蒜子仅在正式域名的文章页加载。

**Tech Stack:** Node.js 24 LTS、Astro、TypeScript、Pagefind、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-11-02-personal-blog-design.md`

## Global Constraints

- GitHub Pages 托管，不维护服务器；沿用已认可原型的布局和视觉风格。
- 长文与短记共用 Markdown 集合；草稿不得进入正式页面、搜索、RSS 或站点地图。
- 分类日常、随想、实践，标签可扩展；固定 `/posts/<slug>/` 链接不依赖分类日期。
- 深空与沙滩独立于明暗；保存偏好、兼容受限存储、尊重减少动态效果。
- 只显示文章阅读量，不显示全站计数；原型与本地预览不得污染真实统计。
- 不编造个人身份、评论配置、阅读数字或上线状态；示例文章明确标注。
- 兼容根路径与 `/my-universe/`，正式地址来自当前仓库的实际 GitHub 信息。

## Review Focus

- 草稿通过直接 URL、搜索、RSS 或站点地图意外泄露：构建产物检查覆盖所有渠道。
- 非根基础路径使资源、分页或搜索失效：项目路径构建并检查全部站内引用。
- 浏览器存储抛错、无效主题或场景：纯函数与浏览器验证回退行为。
- 计数服务或评论服务不可用：正文可用，不显示虚构数字，未配置评论有明确说明。
- 窄屏、关闭 JavaScript、减少动态效果：真实浏览器截图与页面交互检查。

## Task 1: 运行环境、配置和内容基础

**Files:** `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `src/content.config.ts`, `src/site.config.ts`, `src/lib/content.mjs`, `src/lib/paths.mjs`, `tests/content.test.mjs`, `tests/paths.test.mjs`。

**Interfaces:** 内容条目提供 `data.slug/title/date/category/tags/kind/draft/comments`；`withBase(path, base)` 返回带基础路径的站内 URL；`publishedPosts(entries, includeDrafts)` 返回稳定排序、过滤草稿后的内容；摘要和阅读时长为纯函数。

- [x] 写并运行内容过滤、排序、中文阅读时长、摘要、路径编码与基础路径测试，确认缺少实现时失败。
- [x] 安装依赖，实现配置、集合与工具函数；用 Node 原生测试确认通过。
- [x] 加入标为示例的两篇文章、一则短记和一篇草稿。

## Task 2: 页面、阅读与写作

**Files:** `src/layouts/BaseLayout.astro`, `src/components/{Header,Footer,SceneArt,PostList,Pagination,ArticleMeta,Comments,PageViews}.astro`, `src/styles/global.css`, `src/pages/{index,about,archive,404}.astro`, `src/pages/page/[page].astro`, `src/pages/posts/[slug].astro`, `src/pages/categories/[category].astro`, `src/pages/tags/[tag].astro`, `src/pages/{rss.xml,sitemap.xml,robots.txt}.ts`, `src/content/posts/*.md`。

**Interfaces:** 页面通过内容工具取得已发布条目，所有站内链接通过统一路径函数；文章页提供 Pagefind 索引标记；第三方组件只在对应文章页出现。

- [x] 依照原型拆分布局、文章列表、场景插画和中文排版。
- [x] 实现静态内容页、分页、分类、标签、文章目录与上一篇/下一篇。
- [x] 实现 RSS、站点地图、robots、元信息；本地草稿预览有明确标识。
- [x] `astro check` 与静态构建成功，检查草稿不进入产物。

## Task 3: 主题、背景、搜索与外部服务

**Files:** `src/lib/appearance.mjs`, `tests/appearance.test.mjs`, `src/scripts/{appearance,search,article-services}.ts`, `src/components/SearchDialog.astro`。

**Interfaces:** `normalizeAppearance(input)` 提供已验证偏好；场景和明暗使用 HTML 数据属性；搜索动态加载构建索引；评论从公开环境配置读取；阅读量使用服务提供的文章计数 DOM 标记。

- [x] 先验证无效场景、主题、存储数据的偏好归一化测试，再实现纯函数。
- [x] 实现本地偏好恢复、场景选择面板、键盘关闭、动态开关及不可见时暂停。
- [x] 实现搜索弹窗，异步搜索处理过期响应、空结果和失败回退。
- [x] 接入配置就绪才加载的 giscus；同步明暗；按正式域名和构建模式保护文章计数。
- [x] 浏览器验证场景/主题组合、手机面板、搜索与服务失败时阅读不受影响。

## Task 4: 发布、说明与整体验证

**Files:** `.github/workflows/pages.yml`, `.env.example`, `.nvmrc`, `README.md`, `docs/writing.md`, `scripts/check-build.mjs`。

**Interfaces:** `npm run build` 生成带 Pagefind 的 `dist/`；`npm run verify` 执行单元测试、Astro 检查、构建与产物检查；CI 校验 PR，主分支发布 Pages。

- [x] 使用官方 Pages Actions 配置最小权限；拉取请求不发布，发布分支为 main。
- [x] 编写中文写作、部署、giscus 配置和文章计数说明，不要求提交密钥。
- [x] 检查项目路径与根路径构建、草稿排除、全部站内链接、RSS 与站点地图。
- [x] 运行完整验证，桌面和手机截图校正；做一次独立代码审阅并处理重要问题。

## Execution ledger

- 2026-11-02: 设计与编码请求已获用户确认；保留设计稿和原型作为实现依据。
- 2026-11-02: 当前机器没有 Node 命令，使用项目 `.tools/` 中的官方便携版本；该目录不提交。
- Task 1: complete — 内容过滤、排序、中文阅读时长、基础路径、偏好和正式域名计数保护共 9 个单元测试通过；已生成锁文件。
- Task 2: complete — Astro 类型与模板检查 0 错误、0 警告；15 个静态页面、3 篇可搜索文章和 207 个站内引用通过初次产物检查。
- Task 3: complete — 真实 Chrome 验证了中文搜索、草稿排除、320px 布局、跨页与刷新偏好、禁用存储、无 JavaScript 阅读和减少动态设置。
- Final review: fresh independent reviewer read src/scripts/tests/config/workflow；未发现 Critical/Important，发现一个统计迟到响应显示问题，已复现进入修复。
- Ruling: 在当前目录的 feat/personal-blog 分支实现，保留已有设计稿与原型 — 新仓库没有现有产品代码冲突，创建分支已获系统授权；未提交或推送。
- Ruling: 本地与非正式域名不加载第三方评论/计数 — 保持预览不污染真实数据；上线前仍需正式域名验证。
- Final: 计数提供方实际为 JSONP 请求设置 no-referrer-when-downgrade，无需改变全站 referrer policy。浏览器已验证最终 JSONP 请求携带文章独立路径，首个脚本请求不作为计数合并证据。
- Final: 草稿保障由正式内容过滤与静态路由共同实现；产物哨兵检查是补充验证。首页筛选按界面标签仅作用于当前页。
- Final: 将统计迟到响应与占位并存按用户影响升级为 Important，浏览器测试先复现“—42”，再修正超时后继续接收真实结果并恢复提示。

- Task 4: complete — 根路径与 /my-universe/ 两种静态构建、9 个单元测试、Astro 0 错误/警告、207 个站内引用与 10 项真实浏览器检查全部通过。
- Final: fixed 计数迟到响应 — 浏览器测试先出现“—42”失败，修复后全部 10 项浏览器检查通过；完整 verify 通过。
- Deferred minors: none.
- 外部步骤：网站尚未发布；giscus 的仓库 App 授权与公开 ID 尚需管理员配置，真实域名计数上线后复核。

- 2026-11-02: 用户要求提交到远程仓库；交付当前 feat/personal-blog 分支，保留 main 不变。实际提交与推送结果见 Git 历史。
