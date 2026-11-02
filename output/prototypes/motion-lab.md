# 背景与开场选型原型

打开同目录 `motion-lab.html` 可独立体验，所有绘制均在浏览器本地完成，无外部动画素材或依赖下载。它是供用户选择的视觉原型，尚未接入正式 Astro 页面。

## 可选组合

- 整页背景：星系漫游、极光之境、日落海面。
- 开场：粒子汇聚成站名；星门开启后站名浮现。
- 开场约 4.3 秒后显示“进入博客”按钮，点击后进入模拟博客排版；始终可跳过。
- 背景可实时切换、调速、暂停；开场可重播；可收起选型工具。
- “记下这个组合”展示所选组合；通过视觉伴侣服务打开时也写入本地选择事件，正式接入以用户在对话中反馈的选择为准。

## 实现与验证

原生 WebGL 绘制背景，Canvas 2D 绘制开场粒子，CSS 控制标题与按钮出场。粒子动画和背景在后台停止，遵循系统减少动态效果；WebGL 不可用时提供静态背景提示。

Chrome 实际验证三个场景的 WebGL 渲染、两种开场、动画后出现按钮、进入排版、组合记录、收起展开、390px／320px 及减少动态效果。截图在未提交的 `.tools/screenshots/motion-choice/`。

## 参考方向

- [React Bits Galaxy](https://reactbits.dev/backgrounds/galaxy)
- [React Bits Aurora](https://reactbits.dev/backgrounds/aurora)
- [three.js Ocean](https://threejs.org/examples/webgl_shaders_ocean.html)
- [Vanta 背景库](https://www.vantajs.com/)

原型为独立绘制，不是这些组件的原版复刻。

## 正式接入时待确定

用户选择的背景和开场组合；是否首次首页访问播放、同一轮浏览不重复；文章直达链接是否直接阅读。建议将强动效放在开场，博客背景使用低速版本，文章阅读仍保持静态。
