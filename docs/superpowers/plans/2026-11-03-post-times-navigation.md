# 分类、文章时间与导航信息

**Goal:** 桌球贴图归入「生活/运动」；显示创建时间与最近编辑时间至秒，按创建时间倒序；归属地和累计浏览量移至固定导航区域，所有页面可见。

**Confirmed:** 历史文章最近编辑时间等于创建时间；后续修改才生成新的编辑时间。只有日期的历史记录保留原日期，以北京时间 00:00:00 表示，并标明仅精确到日。

**Approach:** 沿用 Astro、现有图标和主题。导航底部增加一行紧凑信息，窄屏换行；复用每页单次不蒜子请求。`date` 保持创建时间，`updated` 初始化为创建时间；构建时依据最近一次文件 Git 提交及其父版本判断是否有后续修改。显式修改 updated 优先；未手填的后续修改使用该文件的提交时间，本地未提交修改使用文件修改时间，重新部署不改变结果。Git 不可用时回退到文章字段。CI 读取完整历史。

## Tasks

- [x] Tests: creation-time ordering with second precision and edits not changing order; Shanghai datetime formatting; Git baseline, later committed/local edits, manual override, stable rebuild, reverting content.
- [x] Add server-side post timestamp resolver; migrate existing metadata and add sports subcategory. Show both timestamps in lists/details; archive order remains created descending.
- [x] Move visitor panel from homepage content to shared fixed header; support every page, 320px width, long locations, large counts, preserved calendar/search controls and header offsets.
- [x] Update build/browser assertions, writing guide, README and blog implementation article to match the new behavior.
- [x] Run full verify, targeted browsers, screenshot QA and final read-only review. Integration follows under the existing publishing authorization.

## Design notes

Keep existing typography and theme variables; no new cards, assets, font downloads, or animation. Navigation information has secondary visual weight. The existing ResizeObserver continues reserving the full fixed-header height.

## Verification record

- Unit tests: 93 passed. New Git-history fixture verifies baseline timestamps, dirty edits, committed edits, rebuild stability, exact content reverts and explicit overrides.
- Astro check: 0 errors, warnings or hints. Static build/output checks: 42 pages, six searchable posts, all local links valid.
- Visitor browser: all checks passed, including single request per page, article PV alongside site PV, local suppression, failures, timeouts, delayed values and 320px header offsets.
- Metadata browser: sports subcategory and photo filtering, created-descending ordering, timestamps to seconds, archive precision note, 320px long region/large count layout passed.
- Screenshots inspected: desktop and 320px navigation; mobile photo details with both times; long mobile navigation/archived items.
- Final read-only code review: no Critical/Important findings. Minor archive precision tooltip was corrected. Markdown edits are automatic; same-path image replacements and file renames require explicit updated, documented in the writing guide.
- Integration: existing authorization covers merging and publishing to main after verification. Remote fetched before integration.
- Existing full browser smoke: all 30 groups passed. Its article placeholder selector is now scoped because every article also has the navigation site counter.
