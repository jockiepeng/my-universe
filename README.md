# 个人小宇宙

以写作为中心的个人博客。Astro 静态生成，GitHub Pages 托管，Markdown 管理文章；不需要维护服务器。

## 本地运行

使用 Node.js 24 LTS：

```sh
npm ci
npm run dev
```

默认本地地址为 `http://127.0.0.1:4321/my-universe/`，以终端实际输出为准。开发模式会显示草稿，并明确标注；正式构建会排除草稿。

搜索索引在构建时生成，要查看完整搜索体验：

```sh
npm run build
npm run preview
```

预览默认地址为 `http://127.0.0.1:4321/my-universe/`。本地预览不会请求真实阅读计数或 giscus 评论。

当前机器也准备了未提交的便携 Node，PowerShell 中可临时使用：

```powershell
$env:PATH=(Join-Path (Get-Location) '.tools\node-v24.22.2-win-x64')+';'+$env:PATH
$env:ASTRO_TELEMETRY_DISABLED='1'
npm run dev
```

## 已实现

- Markdown 长文与短记、分类与标签、日期归档、静态分页。
- 中文正文、长文目录、代码高亮、图片与表格。
- 深空和沙滩场景、独立深浅色、动态开关、本地偏好记忆。
- Pagefind 中文全文搜索、RSS、站点地图、404 与分享元信息。
- giscus 评论接入组件，以及只在正式文章页加载的不蒜子阅读计数。

当前文章与“关于我”包含明确标注的示例文案，发布自己的博客前请替换或删除。详细步骤见 [写作指南](docs/writing.md)。

## GitHub Pages 发布

本仓库对应的默认站点配置是 `https://jockiepeng.github.io/my-universe/`；该配置不代表已经上线。

1. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 将代码提交到 `main`，或者在 `main` 上手动运行 **Check and publish blog** 工作流。
3. 工作流自动测试、检查、构建、生成搜索索引并发布。PR 只检查，不发布。

项目路径会从仓库名称推导，`*.github.io` 用户站点使用根路径。自定义域名时，在仓库 Actions **Variables** 设置 `SITE_URL`（例如 `https://blog.example.com`）和 `BASE_PATH`（根路径填 `/`），并在 Pages 中绑定域名。需要 CNAME 时可放入 `public/CNAME`。

本地可通过环境变量 `SITE_URL`、`BASE_PATH` 覆盖构建地址。配置默认仍为本仓库的项目站点。

## 开启评论

1. 在公开仓库中开启 **Discussions**。
2. 通过 [giscus 配置页](https://giscus.app/zh-CN) 安装 GitHub App，并选择仓库与评论分类。
3. 将生成的公开值填写到仓库 Actions **Variables**：`PUBLIC_GISCUS_REPO`、`PUBLIC_GISCUS_REPO_ID`、`PUBLIC_GISCUS_CATEGORY`、`PUBLIC_GISCUS_CATEGORY_ID`。
4. 重新构建发布。访客使用 GitHub 账号发表评论，管理者在 Discussions 中管理评论。

配置缺失时文章显示“评论暂未开放”。评论按稳定文章 pathname 关联，更改 slug、域名或基础路径时应规划旧讨论的迁移。

## 阅读量

文章详情显示“阅读 — 次”，正式站点从 [不蒜子](https://busuanzi.ibruce.info/) 获取真实页面浏览次数；收到数字后才替换占位。只展示文章阅读量，不展示全站统计。它不是独立读者人数，刷新和重复访问可能再次计数。

只有 HTTPS 且地址匹配构建时的正式域名，才会加载计数。第三方服务不可用时保留占位，文章仍能阅读。发布后需要验证服务在实际域名上的可用性。

## 验证与目录

```sh
npm run verify
```

该命令执行单元测试、Astro 模板与类型检查、静态构建、搜索索引和产物链接/草稿泄露检查。

已安装 Chrome 或 Chromium 时，还可在构建后运行 `npm run test:browser`，检查搜索、场景记忆、窄屏、关闭脚本与文章计数的超时恢复。通过 `BROWSER_PATH` 指定浏览器位置；截图保存在未提交的 `.tools/screenshots/`。计数测试读取公开服务脚本，但拦截所有计数 API 响应，不产生真实阅读计数。

- `src/content/posts/`：文章 Markdown。
- `src/site.config.ts`：站名、描述与公开联系链接。
- `src/pages/`：首页、归档、文章和分类标签页面。
- `src/styles/global.css`：原型的视觉实现。
- `output/prototypes/`：前期交互原型，供设计对照；正式网站不依赖此目录。

设计依据见 [设计稿](docs/superpowers/specs/2026-11-02-personal-blog-design.md)，开发记录见 [实施计划](docs/superpowers/plans/2026-11-02-personal-blog.md)。
