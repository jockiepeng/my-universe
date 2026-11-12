# 每日新闻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现已确认协议中的每日新闻入口、历史浏览及近三天未读通知。

**Architecture:** 继续使用纯静态 Astro。Actions 从固定 Discussion #9 读取指定作者的 Markdown，解析为快照，失败保留旧快照，完整成功时更新及删除；页面与导航通知读取构建时快照。

**Tech Stack:** Astro / TypeScript / Node.js 24 / GitHub GraphQL / Playwright。

**Spec:** `docs/discussion-news-protocol.md`（已确认的 v1.1 协议与接入任务）。

## Global Constraints

- Discussion #9，发布账号 jockiepeng，推送北京时间08:40；无浏览器Token或新服务端。
- 新闻目标10条，历史默认前3条；不足如实显示，空日报不接收。
- 同日修订不重复提醒；仅成功访问该日报后已读，近三天按北京时间。
- 保留规划通知既有行为；不自行提交或推送。

## Review Focus

- 正文中的Markdown、危险链接和字段边界不得注入HTML或误分章节。
- 同日重复、无效日期和错误作者不得覆盖有效快照。
- GitHub失败、分页不完整必须保留快照；删除只在完整成功同步后生效。
- 跨北京时间午夜、直接访问历史、存储不可用不得错误清除未读。
- 新增导航在手机及英文下可用，新闻正文保留原文。

## Tasks

### 1. 解析与同步
- [x] 为 parseNews、collectNews、fetchNews 编写并运行失败测试：有效Markdown、字段缺失、恶意链接、历史日期、重复日期、API失败/分页。
- [x] 实现 `src/lib/news.mjs`、`scripts/sync-news.mjs`；快照 `src/data/news.json` 默认空。
- [x] 运行单元测试，验证重跑/删除/异常保留语义。

### 2. 新闻页面与通知
- [x] 编写 recentNews 日期边界测试并观察失败，实现近三天筛选。
- [x] 添加 `/news/` 最新入口和 `/news/YYYY-MM-DD/` 静态详情、历史导航；安全文本展示，支持无脚本阅读。
- [x] 导航添加每日新闻；新闻状态与规划状态分别管理，共用红点弹窗。
- [x] 运行日期/存储和浏览器测试，检查直接阅读、弹窗不清除、跨标签同步、语言切换和375px布局。

### 3. Actions、说明及验证
- [x] Workflow 增加#9触发、新闻快照缓存和同步；仅成功保存缓存，失败沿用已有快照。
- [x] 添加双语changelog、README运行说明及浏览器检查命令。
- [x] `npm run verify` + `npm run test:news` + 现有通知回归；独立review并修复明确缺陷。

## Execution ledger

- 已按用户批准的协议接入任务开始执行，使用当前干净工作区，保留现有部署配置。此轮未获提交推送指令。

- 基线168测试通过。首轮解析/分页/日期测试从缺模块失败到通过；已读测试发现损坏存储误沿用状态，已修复。
- 独立review发现标题误改会静默当删除、缺少失败状态；已先增加失败回归，再改为指定作者评论严格校验，并用独立news-sync状态保留快照同时提示失败。
- Ruling: 不创建额外worktree或自行提交 — 当前目录干净且用户要求在本仓库实现 — 所有变更保留为可审查的未提交文件。
- Ruling: 初始新闻快照为空 — 本地不读取外部系统密钥、不伪造正式新闻；真实日报由Actions首次同步 — 本地默认展示空状态，部署后同步成功才有日报。
- 最终验证：181项测试通过，Astro 209文件0错误0警告；生产构建/链接检查、新闻浏览器和既有规划通知回归通过。Workflow YAML语法通过。真实GitHub凭证/首次生产同步未在本地验证。
- 提交阶段：用户已明确授权将每日新闻功能与新增《美丽人生》观后感一起审查、提交并推送。
