# 人生长卷 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将人生格子升级为七阶段角色旅程、横转竖格子、未来寄语、完整全屏与 PNG 分享。

**Architecture:** 保留 life-grid.mjs 日期计算。life-journey.mjs 提供阶段分组、布局、字数与文案；life-painter.ts 共用 Canvas 绘图，PNG 角色图集同时用于舞台与海报。life-grid.ts 编排旅程／全景状态、全屏和查询，life-share.ts 管理预览、导出与分享。后续完整地面及石片方案见 `2026-11-03-life-stone-terrain.md`。

**Tech Stack:** Astro、TypeScript、SVG、Canvas 2D、原生 dialog、Web Share API；无新依赖。

**Spec:** `docs/superpowers/specs/2026-11-03-life-journey-design.md`

## Global Constraints

- 保留公历日、闰日、1–120 岁、日／周统计与默认示例；不保存或上传输入。
- 七阶段年龄边界 0/3/12/18/30/45/60；角色只走到今天；过去与未来不可混淆。
- 全屏必须完整显示所有格子，没有内部拖动；任何手机方向都按宽高重新布局。
- 演出可跳过、重播；减少动态直接显示静态全貌；所有中断取消旧动画。
- PNG 包含全部格子、阶段、今日位置和寄语；出生日期默认不印；分享取消不是错误。
- 继续在共享工作分支原地实现，保留既有未提交文件，不提交或发布。

## Review Focus

- 阶段跨生日、闰日、跨阶段周：精确按日历生日；Task 1 单测。
- 超长寄语和 emoji：可见字符上限 80，单词也能换行；Task 1 单测、Task 3 图片验证。
- 横竖屏和 120 年最大规模：全屏最后一格仍在边界内；Task 2 布局单测、Task 3 浏览器测试。
- 重播中切换／跳过／主题改变：旧帧不覆盖新画面；Task 3 浏览器测试。
- 分享预览过期和取消：输入修改时更新，URL 清理，取消后可重新分享；Task 3 浏览器测试。

### Task 1: 阶段、布局与统一绘制

**Files:** Create `src/lib/life-journey.mjs`, `tests/life-journey.test.mjs`, `src/lib/life-painter.ts`, `src/components/LifeCharacter.astro`.

**Interfaces:** `stageSegments(life, unit)` 返回每阶段起止日、firstCell/endCell；`stageAtDay(life, day)` 返回阶段；`fitGrid(count, width, height, orientation)` 返回完整容纳的 columns/rows/pitch/x/y；`cellPosition(layout,index)` 支持横向列优先、纵向行优先；`normalizeWish(value)` 提供默认寄语、按可见字符截断。`paintLifeGrid` 对普通、全屏、导出共用同一数据；七个 SVG 角色统一自有矢量图形。

- [x] 先写单测，运行确认新模块缺失失败。
- [x] 实现阶段与布局，在 320px 及横屏极限、日周末格断言全部容纳并通过单测。
- [x] 实现共享 Canvas 绘制（阶段色、过去路迹、未来空格、今天停驻），人物及导出角色绘图；按用户反馈升级为 PNG 绘本角色。

### Task 2: 页面与旅程、全屏交互

**Files:** Modify `src/pages/tools/life.astro`, `src/scripts/life-grid.ts`, `src/styles/life-grid.css`; create `src/styles/life-journey.css`.

**Interfaces:** 页面保留 `[data-life-grid]`、既有统计和查询属性；新增 `data-phase=journey|turn|overview`、角色轨道、跳过／重播、`dialog[data-life-fullscreen]`；全屏单独 Canvas 消费同一布局和选中格。

- [x] 更新浏览器脚本旧“放大滚动”验收为全屏不滚动、七阶段角色、寄语保留、跳过和重播；在旧构建看到新控件缺失失败。
- [x] 实现横向地面 → 镜头拉远过渡 → 纵向全景，角色按年龄变化；示例不强制演出。以用户后续确认的完整石片地面方案为准。
- [x] 实现全屏 dialog、焦点恢复、Escape、方向键／格号查询；日周切换、主题、跨天和 resize 同步。

### Task 3: 分享海报与完整验收

**Files:** Create `src/scripts/life-share.ts`; modify `scripts/life-grid-browser-smoke.mjs`.

**Interfaces:** `setupLifeShare(root, getSnapshot)` 接受当前 life/unit/愿望/生日显示开关/示例快照；先生成 Blob 与预览，再提供下载和原生文件分享；绘制使用 Task 1 共用模块。

- [x] 浏览器验收先要求生成 PNG 预览失败，再实现完整 1600px 宽海报、文字换行、阶段角色和日期隐私开关。
- [x] 验证实际下载 PNG 解码、生日开关、长句／emoji、无文件分享、取消回退、重复生成和预览更新。
- [x] 完整 verify、真实 Chromium 日周／动画／手机／全屏／分享验证，人工看关键帧与海报。
- [x] 独立代码审阅，修复重要问题并验证；最终结果同步于石片地面计划。

## 执行记录

- 用户已确认方案，原生执行，不再请求执行方式确认。
- Pre-flight: Task 2/3 均消费 Task 1 阶段及布局；海报与全屏必须复用同一画格算法；日历统计继续由现有 life-grid.mjs 负责。
- 角色已按用户反馈替换为七列四帧透明图集，来源与提示记录于 `../specs/2026-11-03-life-character-art.md`。
- 独立审阅后的修正包括第一帧计时、Canvas 键盘焦点、长 emoji 寄语排版、角色脚点和图集裁剪；后续完整地面与镜头的验证见石片地面计划。
