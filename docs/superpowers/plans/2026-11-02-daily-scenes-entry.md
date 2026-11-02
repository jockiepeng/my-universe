# 日期尾号动效与入场实施计划

> 使用 executing-plans 在当前功能分支逐项完成，保留工作区中已有「随想」调整。

**目标：** 用户已选定全部三种 WebGL 背景和两种开场，以北京时间日期个位数作为随机种子分配组合。

**设计依据：** `output/prototypes/motion-lab.html` 已由用户选择全部采用；动态只用于首页，文章阅读保持静态。GitHub Pages 静态部署，不增加 React 或网络素材依赖。

## 约定

- 日期尾号指北京时间当天日数的个位数，例如 2、12、22 日使用同一组合；同日所有读者默认相同。
- 固定打乱六种组合再扩展到十个尾号，保证三种背景和两种开场都有机会出现。
- 手动选择只在当天生效，次日回到自动；主题与动态开关长期保留。
- 约 4.3 秒开场后出现进入按钮，始终允许跳过。当天首次首页访问自动播放，sessionStorage 记录已进入；有首页锚点、文章直达不阻拦。
- 减少动态或用户关闭动态时直接展示开场结尾；无 JavaScript 直接显示博客；无 WebGL 使用静态背景。
- 午夜刷新自动组合，但不重新打断已经阅读的人。

## 任务

- [x] `src/lib/motion.mjs`：组合算法、日期及偏好解析；测试日期尾号、跨午夜、六组合覆盖、手动过期与异常存储。
- [x] `src/lib/scene-shaders.mjs` / `src/scripts/home-scene.ts`：迁移已选三场景，原生 WebGL、后台暂停、像素上限、静态回退与 context loss。
- [x] `src/components/EntryGate.astro` / `src/scripts/entry-gate.ts`：两个开场、按钮／跳过、焦点与 inert、session 去重、重播和静态结尾。
- [x] `Header` / `BaseLayout` / `appearance` / CSS：自动与手动选择、三套背景、首页和文章区别，保留导航日历与随想。
- [x] README 与浏览器回归：日期规则、三场景截图、两个开场、去重／重播、午夜、减少动态、无 JS／无 WebGL、移动端、既有滚动与阅读服务。

## 验证

`npm run verify` 与 `node scripts/browser-smoke.mjs`。完成后进行一次独立只读审查。本次不自动提交、推送或合并。

## 完成记录

- 日期规则、偏好与现有测试共 33 项通过，Astro 0 errors / 0 warnings / 0 hints。
- 共享工作区中的并行贴图测试曾临时加入验证文章；保留其文件，在 `.tools/motion-verification` 独立快照中验证动效，随后刷新主目录构建。
- 最终构建 17 个页面、2 篇搜索文章；30 项浏览器交互检查通过，含 320px/390px 入场、三个 WebGL 场景、两个开场、焦点、午夜、禁用存储、无 WebGL、无 JavaScript。
- 独立审查发现用户 motion:false 时仍有 CSS 过渡；失败验证复现后，为该偏好关闭所有入场／退场过渡并立即关闭，回归通过。
- 本轮未自动提交或推送。
