# 背景音乐

博客使用原生 HTML audio 播放三首本地 MP3，页面左下角的“背景音乐”入口在展开后提供播放、暂停、上一首、下一首、选曲、音量和进度控制。播完按曲目顺序循环。

首次访问默认关闭，不设置音频 src、不预加载文件。初始音量为 20%，点击播放后才下载当前曲目。首页开场期间隐藏音乐入口，正文和小游戏不依赖音频加载成功。

## 曲目与署名

| 曲目 | 作者 | 原曲页面 |
| --- | --- | --- |
| Moonlight | Scott Buckley | https://www.scottbuckley.com.au/library/moonlight/ |
| Hiraeth | Scott Buckley | https://www.scottbuckley.com.au/library/hiraeth/ |
| Dream Culture | Kevin MacLeod (incompetech.com) | https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1300046 |

三首均按作者曲库标注的 CC BY 4.0 使用，播放器显示当前曲目、作者、原曲链接及许可链接。完整署名与官方下载地址见 `public/audio/credits.txt`，曲目配置集中在 `src/data/music-tracks.json`。`public/audio/manifest.json` 保存下载日期、字节数及 SHA-256，专用浏览器检查也验证构建产物与这些记录一致。MP3 保持原样，未剪辑或转码。

Scott Buckley 的说明页还列有与其他媒体配合使用、不得独立转售或向音乐流媒体平台再上传、不得注册 Content ID 等要求。本项目将音乐作为博客内容的伴奏，不提供专门下载按钮或独立音乐分发服务。原作者条款见 [Scott Buckley 使用说明](https://www.scottbuckley.com.au/library/using-this-music/) 和 [Incompetech FAQ](https://incompetech.com/music/royalty-free/faq.html)。

## 偏好与切页

`localStorage` 记住曲目、播放位置与音量；`sessionStorage` 记录用户在本标签页是否明确开启音乐。关闭后即使刷新或切歌也不会自行播放。通过浏览器或系统媒体控制暂停，也会同步播放器和续播状态。首次新标签页不会直接出声，存储不可用时仍能操作。

网站沿用整页导航，切页会短暂中断音频；同标签页已开启时会尝试从保存位置恢复。浏览器若拒绝自动续播，播放器提示点击播放。它不保证无缝跨页，也不绕过浏览器自动播放策略。

音乐请求失败时提示重试或换歌，正文不受影响。失败后不会自动跳过整张歌单反复发请求；恢复网络后可点击播放或选择其他曲目。

## 验证

先运行 `npm run verify`，再运行 `npm run test:music`。专用浏览器检查启动本地静态服务和 Chrome，验证三首真实音频解码、初次零请求、暂停与切歌、循环、音量与进度、刷新和切页、播放拒绝、音频失败、受限存储、320px 触屏与键盘。截图保存在 `.tools/screenshots/music/`。

播放器文件独立放在 `MusicPlayer.astro`、`music-player.ts` 与 `music-player.css` 中，从 `BaseLayout.astro` 挂载。站点 base path 由现有 `href()` 统一处理，不在浏览器运行时请求作者网站。
