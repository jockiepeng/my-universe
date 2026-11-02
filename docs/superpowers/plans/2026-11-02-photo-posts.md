# 贴图类型实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持顶部多图、底部纯文字的贴图，并移除短记类型。

**Architecture:** 在现有内容集合中保留 `post`、新增 `photo`；图片配置和正文分开，复用多图组件展示到列表和详情，纯文字通过 Astro 转义输出。沿用现有静态构建、图片优化、分类和搜索。

**Tech Stack:** Astro、TypeScript、原生 CSS、Node.js 测试、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-02-photo-post-design.md`

## Global Constraints

- 不新增依赖；保留其他未提交改动，不提交或发布。
- 贴图为 `kind: photo`，1–9 张图片，每张提供 `src`、`alt`。
- 首页和详情页均为图片在前、纯文字在后；正文保留换行，不插入图片。
- 只支持 `post` 和 `photo`，不再支持 `note`。
- 当前仓库包含其他正在进行的修改，就地做小范围编辑，不切换工作区或重置文件。

## Review Focus

- 单图不裁切，2 / 4 张使用双列，其他多图最多三列。
- 手机宽度 375px、深色模式和长文字不溢出。
- 正文中的 Markdown / HTML 图片给出明确错误，普通文章仍可插图。
- 图片说明不能为空，缺图、超过九张、贴图重复设置封面应被拒绝。
- 草稿不进入正式产物，现有文章和站点搜索保持可用。

## Task 1: 内容规则

**Files:** `src/lib/photo-posts.mjs`、`src/lib/published-loader.mjs`、`src/content.config.ts`、`src/lib/posts.ts`、`tests/photo-posts.test.mjs`

**Interfaces:** `photoPostIssues(data)` 返回 `{ path, message }[]`；`validatePhotoBody(body, label)` 对贴图正文图片抛出带文稿名的错误。

复核补充：生产加载器在 Astro 收集图片资源前移除草稿，避免草稿独有原图进入静态产物；开发环境保留草稿。

- [x] 先写并运行图片数量、类型、封面和正文图片规则测试，确认失败。
- [x] 实现规则并接入 schema 和 `getPosts()`，运行测试确认通过。

## Task 2: 展示与写作

**Files:** 新增 `src/components/PhotoPost.astro`；修改 `PostList.astro`、文章详情、首页、元信息、归档、搜索提示、`global.css`、`docs/writing.md`、`drafts/`、README 中的对应说明。

**Interfaces:** `PhotoPost` 接收 `post: Post`，输出图片网格与纯文字段落。保留 `.u-post[data-kind]` 过滤接口。

- [x] 接入组件，添加贴图筛选，清除短记的产品分支和样式。
- [x] 提供可复制的贴图草稿模板与图片管理说明。
- [x] 用临时的 1 / 2 / 4 / 9 图内容构建并在浏览器验证顺序、原图链接、过滤、换行、移动端布局和 HTML 转义；移除临时内容。

## Task 3: 验证与复核

- [x] 运行 `npm run verify` 与必要的浏览器检查。
- [x] 复核本次改动、搜索短记残留，确认无测试文稿被发布。
- [x] 汇报结果和写法，不提交或发布。

验证记录：33 项单元测试通过，Astro 检查无错误、警告或提示；正式构建和链接检查通过。临时贴图在 1360px / 375px Chrome 中验证通过，草稿独有原图不进入产物。清理测试文稿后，常规浏览器回归在独立构建快照上全部通过。
