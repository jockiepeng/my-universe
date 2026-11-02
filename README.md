# jockie的小宇宙

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
- 固定导航中的紧凑日期／时间入口，展开查看北京时间、月历与倒计时；页脚随正文自然排版。
- 首页整页 Canvas 动态深空（星云、轨道、流星）与沙滩（日落、潮汐），文章阅读背景保持静态。
- 日历支持前后翻月、指定年月跳转、回到本月；每日一句按北京时间日期随机选取。
- 2027 元旦与农历新年倒计时，文章右侧返回顶部箭头。
- Pagefind 中文全文搜索、RSS、站点地图、404 与分享元信息。
- giscus 评论接入组件，以及只在正式文章页加载的不蒜子阅读计数。

当前仅保留“AI 探索”和“知识库实践”两篇文章；“关于我”与每日一句仍含示例文案，可自行替换。写作方法见 [写作指南](docs/writing.md)。

已从 [原博客仓库](https://github.com/tcpjq/jockie_website) 迁入这两篇 Markdown 和全部 10 张配图，按要求删除其他示例与草稿。迁移保留正文、发布日期和标签，图片改为文章相对路径，由 Astro 构建成本地静态资源；原“技术”分类归入“实践”。迁移记录见 [文章迁移说明](docs/content-migration.md)，源仓库保持原样。

## 阅读量如何实现

文章详情页通过 **不蒜子（Busuanzi）** 显示该页面的访问次数，不显示全站访问量。入口是 `PageViews.astro`，加载逻辑在 `src/scripts/article-services.ts`。

1. 页面先显示 `阅读 — 次`。只有正式构建、当前来源为配置的 HTTPS 正式域名时，才加载 `https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js`；本地开发和本地预览不会计数。
2. 服务脚本使用 JSONP 请求计数。目前引入的不蒜子脚本会为它创建的 JSONP 请求设置 `no-referrer-when-downgrade`，向 HTTPS 统计服务提供完整文章地址，让服务按文章路径区分 PV，而不是把所有文章归到同一个域名；浏览器检查也验证了这个请求携带完整路径。
3. 服务返回数字后替换占位。12 秒后仍无结果，提示统计暂不可用；晚到的成功响应仍可正常显示。服务加载失败不会影响阅读。

**统计口径是 PV（页面访问次数）**，刷新或重复打开也可能增加；它不等于独立读者数，也不能证明读完了文章。数据保存在第三方服务，不写回 GitHub、不使用浏览器本地数字伪造计数。网络、浏览器隐私策略和拦截器会影响统计。改变域名或文章路径可能产生新的统计记录，旧博客的历史计数不会随 Markdown 一起迁移。

## 评论如何实现

评论使用 **[giscus](https://giscus.app/zh-CN)**，实际数据保存在指定 GitHub 仓库的 **Discussions**，无需自建后端或数据库。`Comments.astro` 输出配置，`article-services.ts` 在评论区域进入视口附近（200px）时才加载 giscus iframe；同样仅在正式域名启用。

- 使用 `pathname` 映射和严格匹配：同一文章路径对应同一条 Discussion。首次打开没有评论时不会立即新建讨论，读者第一次实际评论时由 giscus 创建。
- 评论者通过 GitHub 登录，评论、回复与表情由 GitHub／giscus 管理。仓库管理者可在 Discussions 中管理内容。
- 文章默认开启评论；短记默认关闭，也可用 frontmatter 的 `comments: true/false` 单独覆盖。缺少仓库或分类 ID 时显示“评论暂未开放”。
- 评论跟随深浅色切换；加载失败时保留前往 Discussions 的入口。更改文章路径或评论仓库后需处理原讨论映射，Markdown 迁移不会自动搬运旧评论。

下面的配置值在 **构建时** 写入页面，属于公开标识，不是令牌；修改 Actions Variables 后需要重新运行构建部署。

## 首页背景

首页使用固定在视口上的 **整页 Canvas 2D 动态背景**，滚动后仍覆盖全屏，不局限于头部区域，也不请求外部视频或动画素材。深空包含星点、星云、绕行卫星和周期流星，沙滩包含落日反光、海面波纹与潮汐。文章列表和每日一句使用衬底保证可读性，文章详情不包含动画画布。

导航中可换场景、深浅色；页脚可关闭动态。偏好只保存在当前浏览器。画布约 30fps、像素比上限 1.5，切到后台或系统启用“减少动态效果”时停止逐帧绘制；无 JavaScript 时保留静态渐变背景。

设计调研参考：[Anthony Fu](https://antfu.me/) 的个人站与生成艺术方向、[Josh Comeau 的博客复盘](https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/) 中的首页生成式彩虹、[Butterfly 官方背景特效配置](https://butterfly.js.org/posts/4aa8abbe/)。本项目独立实现场景绘制。

## 更新每日一句

编辑 [`src/data/daily-quotes.json`](src/data/daily-quotes.json)，每条填写唯一 `id`、`text` 和可选的 `source`（出处／作者）。当前提供 8 条原创示例，不冒用名人引言。更新后提交并通过 GitHub Actions 重新构建即可；不需要后端。

算法在 `src/lib/daily-quote.mjs`：以 **北京时间的年月日** 为种子，用 FNV-1a 哈希和 Mulberry32 混合后映射到文案数组。相同日期与文案数组得到相同结果，同一天刷新或换浏览器不会不断变化；跨日重新选择，随机选择可能重复。页面打开到午夜也会自动刷新，从后台返回时会校正日期。空数组显示占位文案，单条数组一直显示该条。无 JavaScript 时仍有构建时选出的文案。

文案会随静态站点发布到浏览器，请将准备公开的内容放在这个文件中。

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

已安装 Chrome 或 Chromium 时，还可在构建后运行 `npm run test:browser`，检查整页动效与关闭开关、真实滚轮、日历跳月、每日一句跨日、迁移配图、搜索、窄屏、关闭脚本与文章计数的超时恢复。通过 `BROWSER_PATH` 指定浏览器位置；截图保存在未提交的 `.tools/screenshots/`。计数测试读取公开服务脚本，但拦截所有计数 API 响应，不产生真实阅读计数。

- `src/content/posts/`：文章 Markdown。
- `src/site.config.ts`：站名、描述与公开联系链接。
- `src/pages/`：首页、归档、文章和分类标签页面。
- `src/styles/global.css`：原型的视觉实现。
- `output/prototypes/`：前期交互原型，供设计对照；正式网站不依赖此目录。

设计依据见 [设计稿](docs/superpowers/specs/2026-11-02-personal-blog-design.md)，开发记录见 [实施计划](docs/superpowers/plans/2026-11-02-personal-blog.md)。
