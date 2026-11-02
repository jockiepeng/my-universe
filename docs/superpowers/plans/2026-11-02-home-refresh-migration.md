# 首页动效、紧凑日历与文章迁移 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落实用户五项调整，继续保持 GitHub Pages 静态部署。

**Architecture:** 页脚回到文档流，固定导航保留；日历、时钟与倒计时共用导航弹层。首页整页 Canvas 绘制深空或海岸场景，阅读页没有动画画布。仅保留指定的两篇旧仓库文章与十张图片，保留日期和标签。

**Tech Stack:** Astro、TypeScript、Canvas 2D、Markdown、Playwright。

**Spec:** 本轮用户五项调整及已有博客设计文档。

## Global Constraints

- 品牌：jockie的小宇宙；固定顶部导航、桌面粘性目录保留。
- 2027 元旦、2027-02-06 农历新年，使用 UTC+8。
- 不改动源仓库，不迁移第三方服务历史计数与评论。
- 不自动提交或发布本轮变更。

## Review Focus

- 320px 下导航及弹层不横向溢出。
- 滚轮、锚点与键盘焦点不被固定导航阻断。
- 关闭动画、减少动态效果、页面隐藏时停止动画；文章页无画布。
- 迁移图片支持 /my-universe/ 项目路径，草稿不进入正式构建或搜索。
- 日历跨日、跨年刷新，弹层支持 Escape、点外部关闭。

## Tasks

- [x] Header/CalendarClock/calendar-clock：导航紧凑日期时间入口，点击显示月历与倒计时；移除首页侧栏大组件。
- [x] global.css/fixed-bars：页脚正常文档流，删除底部预留；目录和返回顶部独立于页脚。
- [x] HomeScene/home-scene：首页动态星云、星轨、流星及海浪，保留静态回退和用户动态开关。
- [x] posts/assets：迁移指定两篇 Markdown 与十张图片，删除其他文章与草稿，适配 frontmatter 和链接，记录来源与分类映射。
- [x] README：解释阅读量的加载、统计口径、来源及限制，解释 giscus 与 Discussions 的对应关系和部署配置。
- [x] browser-smoke：更新页脚期望、弹层行为、真实滚轮、动态开关、静态阅读、迁移图片及移动端检查。
- [x] npm run verify、浏览器检查、截图视觉复核、独立代码审查。

## 背景参考

- [Anthony Fu](https://antfu.me/)：生成艺术与个人博客相结合的方向。
- [Josh Comeau 博客设计复盘](https://www.joshwcomeau.com/blog/how-i-built-my-blog-v2/)：首页生成式彩虹和细节交互。
- [Butterfly 官方背景特效配置](https://butterfly.js.org/posts/4aa8abbe/)：可选背景效果、移动端控制。

本仓库独立实现场景绘制，不复制上述网站代码或图像。

## 用户后续调整（覆盖前文对应项）

- 只保留 AI 探索、知识库两篇文章，删除其他文章（包括示例与草稿）。
- 首页使用固定于视口的整页动画背景，首屏不再单独容纳动画；列表／每日一句使用可读的衬底；文章页仍无动画。
- 日历增加上月、下月、回到本月；查看其他月份时实时时钟更新不重置浏览月份。
- 新增每日一句：文案独立 JSON 文件；按北京时间日期作为种子选择，同日稳定、跨日刷新；支持空列表与单条数据。
- 验证覆盖：两篇文章及十图、月份跨年跳转及返回本月、点击弹层内部不关闭、每日一句日期边界及数据更新、整页画布覆盖视口。

## 最终验证

- 22 项单元测试通过；Astro 0 errors / 0 warnings / 0 hints。
- 17 个静态页面，Pagefind 仅索引两篇文章；289 个站内链接／资源检查通过。
- Chrome 浏览器检查通过：整页背景、动效开关、真实滚轮、静态阅读、目录与返回顶部、日历翻月／跳转／跨年、每日一句午夜刷新、窄屏、搜索和十张配图。
- 独立只读审查发现的日历内部点击关闭问题已修复，复审无阻塞问题。
- 本轮修改未提交／推送；本地预览 http://127.0.0.1:4321/my-universe/。
