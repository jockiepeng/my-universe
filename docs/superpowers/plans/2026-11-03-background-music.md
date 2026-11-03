# Background Music Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. User has requested the chosen three tracks and background playback. Work in current checkout without editing the other window's shared style/smoke changes.

**Goal:** 下载三首选定音乐，提供默认关闭、支持控制和署名的博客背景音乐。

**Architecture:** 独立 Astro 组件、CSS 和 TypeScript 控制原生 audio；本地 MP3 随静态站发布。localStorage 记忆曲目音量进度，sessionStorage 记录用户本标签页的播放意愿。

**Tech Stack:** Astro、TypeScript、HTMLAudioElement、Playwright、Node.js。

**Spec:** docs/superpowers/specs/2026-11-03-background-music-design.md

## Global Constraints

- 默认关闭、首次不请求音频，音量 20%。
- 顺序 Moonlight、Hiraeth、Dream Culture；三首原始 MP3 本地托管，保留署名。
- 正确包含 GitHub Pages base path，兼容 320px、键盘、无 JS、受限存储与拒绝自动播放。
- 切页恢复是尽力而为，保留原有整页导航，不引入路由系统。
- 不修改其他窗口的 global.css 和 browser-smoke.mjs，不自动提交推送。

## Review Focus

- 音频 load/play/切歌并发时，迟到响应不能改变新曲目的状态。
- 暂停、播放失败或自动播放拒绝不能出现错误的“正在播放”标记。
- 恢复时间不得跨曲目误用，无效存储不可导致初始化失败。
- 音频较大，默认不能下载三首或阻塞正文。
- 署名要可见、来源可访问，不能把 HTML 错误页当 MP3。

## Task 1 音频与组件

- [x] 从作者官方地址下载三首 MP3，检查文件头、哈希和真实浏览器解码。
- [x] 先添加 scripts/music-browser-smoke.mjs，运行确认缺少播放器失败。
- [x] 新建 src/data/music-tracks.json、src/components/MusicPlayer.astro、src/scripts/music-player.ts、src/styles/music-player.css；在 BaseLayout 引入。
- [x] 完成手动播放、暂停、选曲、前后切换、结束循环、音量、进度与失败恢复。

## Task 2 恢复与验证

- [x] 覆盖偏好恢复、受限存储、自动播放拒绝、失败重试、真实音频、320px 和键盘操作。
- [x] npm run verify，专用浏览器检查，查看桌面与手机截图。
- [x] 保存署名、来源和音频校验记录；独立只读审阅并处理重要问题。

## Execution ledger

- 采用独立文件挂载，保留其他窗口未提交修改。
- 浏览器 RED：初始缺少 data-music，测试失败；组件接入后进入交互验证。
- 过期曲目恢复 RED：旧曲目 time=9999 被错误用于默认曲目，显示 166:39；仅在曲目 ID 仍有效时恢复时间。
- 独立审阅发现原生媒体暂停未同步状态；浏览器先复现 data-state 仍为 playing，再增加原生 pause/playing 监听并根据当前音频状态过滤迟到事件。
- Chrome 对脚本触发导航后的续播返回 NotAllowedError；播放器已按设计提示手动播放，浏览器检查覆盖该允许的回退路径。
- 修复后首次完整浏览器回归通过 8 组检查；手机和桌面截图已查看，继续补充首页开场、无 JS 检查并等待完整音频下载。
- 最终下载完成：Moonlight 10,177,523 字节；Hiraeth 13,851,302 字节；Dream Culture 8,576,659 字节。Dream Culture 使用作者 www 官方地址断点续传完成；原文件未转码。
- 最终 npm run verify 通过：86 个单元测试，Astro 0 errors / 0 warnings / 0 hints，38 页构建、104 文件与 889 个站内引用检查通过。
- 最终音乐浏览器回归 11 组全部通过，包括完整产物字节数与 SHA-256、原生暂停修复、真实音频播放、跨页策略回退、开场与无 JS；截图位于 .tools/screenshots/music/。
- 其他窗口的 global.css 与 browser-smoke.mjs 校验值保持接入前一致；本地 4322 开发预览返回 HTTP 200 并含三首播放器；未自动提交或推送。
