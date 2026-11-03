# 时间铺路石 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 执行用户确认的「时间铺路石」推荐：完整人生格子地面、真实日期路径、石片材质与脚印、全景与跟随镜头，保留已有全屏和分享。

**Architecture:** 一张固定世界坐标的人生地面，每格唯一对应现有公历日／周模型。一行代表一个生日年，按蛇形连续路径连接。远景缓存完整世界，近景按同一坐标补绘石片细节，镜头改变视野而不替换／重新编号地砖。

**Tech Stack:** 现有 Canvas 2D、2.5D 仿射投影、角色 PNG 图集、TypeScript；无新依赖或新图片生成。

**Spec:** `docs/superpowers/specs/2026-11-03-life-journey-design.md`，并以下文用户确认的修订为准。

## Global Constraints

- 用户已确认时间铺路石设计并要求继续执行。地面必须包含完整一生，不采用局部地砖重新编号的替代方案。
- 保留日周数据、闰日、完整全屏、未来寄语与 PNG 分享；不保存或上传输入，不发布。
- 未来为留白石片，过去逐渐着色并有磨痕，今天暖金光；近景有倒角、接缝、足迹和接触阴影。
- 演出为时光快进：全景展示整个人生，阶段落点放慢数个真实日／周脚步，阶段间镜头拉远快进，停在今天后转完整纵向全景。每格的日期始终固定。
- 提供「跟随脚步／看完整地面」，全景模式在整个演出期间容纳全部格子；关闭动态仍可读完整结果。

## Review Focus

- 日／周在生日年边界只分组不重复，末格与闰日不丢失；Task 1。
- 蛇形路径换行连续，人物朝向与路径一致，脚在同一个世界坐标；Task 1/2。
- 全景镜头完整容纳极端寿命与手机；Task 1/3。
- 缓存只存固定地面，揭示范围与当前日期严格一致，切换与主题不留旧缓存；Task 2/3。
- 动画自然结束、跳过、切换、减少动态、暂停后恢复均能收束；Task 3。

### Task 1: 完整地面与镜头数学

**Files:** Create `src/lib/life-terrain.mjs`, `tests/life-terrain.test.mjs`。

**Interfaces:** `createTerrain(life, unit)` 返回 count、生日年行、每格固定世界位置；`terrainCell(terrain,index)`；`terrainStep(terrain,index)` 返回相邻格间的脚点和朝向；`terrainCamera(terrain,width,height,focus,zoom)`；`projectTerrain(camera,x,z)`。

- [x] 写测试并确认模块缺失失败。
- [x] 验证所有格子唯一、日周生日边界、蛇形换行、首尾／今天定位、手机全景边界和相邻脚点。

### Task 2: 石片地面、真实路径与镜头

**Files:** Create `src/lib/life-stones.ts`; modify `src/scripts/life-grid.ts`, `src/pages/tools/life.astro`, `src/styles/life-journey.css`, `src/lib/life-painter.ts`。

- [x] 替换旧局部地面演出，完整缓存留白／走过两层，按真实路径揭示；同世界坐标近景绘制倒角、磨痕与足迹。
- [x] 阶段间镜头拉远、阶段内真实逐格脚步、停在今天；跟随／完整地面与暂停控制保持可用。
- [x] 普通全景及分享格子加入石片色与边缘；时间接缝用于地面，全景与海报保持紧凑排布和阶段轴，保证所有格子完整。

### Task 3: 验收与交付

- [x] 浏览器验证新角色、全景／跟随地面、暂停／恢复、完整动画自然结束、日周／全屏／PNG 回归。
- [x] 看桌面／手机地面关键帧和分享 PNG，不只检查计数。
- [x] 完整 verify，独立审阅核心完整地面逻辑并修复重要问题；记录结果。

## 执行记录

- 完整地面每格唯一映射；日／周、1／80／120 年及手机横竖屏均有边界测试。普通全景和海报的格子优先完整展示，细节随格子尺寸调整；生日年与近似月份接缝用于地面。
- 独立审阅发现镜头过渡时人物离开视野：先确认回归测试失败，再改为插值完整的远／近镜头变换；6 项地面测试通过。
- 独立审阅发现超出寿命的末格误标为实际今天：新增 `journeyDay`，末格使用设定终点前一天并完整填色；浏览器确认一岁寿命的末周停在 2000-12-31，角色仍为婴儿。
- 完整 verify 已通过 113 项测试、Astro 检查、构建与 1131 个站内资源／链接检查。浏览器已通过自然结束、暂停、跳过重播、日周切换、全屏、分享与移动端检查。
- 图片检查：桌面／手机的跟随与完整地面、320px 全屏、1600×2400 日／周分享图。手机全景日期标签被裁切的浏览器断言先失败，再将标签位置约束在画布内；最终浏览器回归通过并重新截图。
- 最终 verify：113/113 tests；Astro 0 errors / 0 warnings / 0 hints；构建及 124 个产物、1131 个站内资源／链接检查通过。`git diff --check` 通过。交付共享工作区，入口「工具 → 人生格子」，未提交、推送或发布。
