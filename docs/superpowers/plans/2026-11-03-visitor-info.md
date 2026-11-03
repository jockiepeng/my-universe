# Homepage Visitor Info Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the following tasks inline, then request one final code review.

**Goal:** 首页显示当前访客归属地与全站累计浏览次数。

**Architecture:** 复用正式来源校验；抽取全站共享统计脚本，每页只加载一次不蒜子。首页独立组件和脚本加载归属地，文章评论继续使用现有逻辑。

**Tech Stack:** Astro, TypeScript, Node test runner, Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-visitor-info-design.md`

## Global Constraints

- 只展示 PV，不展示访客人数，不存储原始 IP。
- 只有 HTTPS 正式来源发送第三方请求，预览不计数。
- 统计与归属地独立失败，不影响正文、评论、音乐与游戏。
- 单次页面加载最多一次不蒜子脚本和计数请求。

## Review Focus

- 文章上同时统计全站 PV 与文章 PV，不得双计数。
- 统计迟到响应必须替换占位；合法零值也应显示。
- 定位超时、错误响应、缺失字段与不可信字符串必须正确降级。
- 首页窄屏、深浅色和无 JavaScript 可读，无横向溢出。
- 页面测试拦截外部响应，不能污染正式计数或依赖真实位置。

## Task 1: Shared views and homepage visitor panel

Files: `src/scripts/page-views.ts`, `src/scripts/article-services.ts`, `src/layouts/BaseLayout.astro`, `src/components/VisitorInfo.astro`, `src/components/HomeContent.astro`, `src/lib/visitor-location.mjs`, `src/scripts/visitor-info.ts`, `tests/visitor-location.test.mjs`, `scripts/visitor-info-browser-smoke.mjs`.

Interfaces: `formatVisitorLocation(data)` returns a region string or null; `page-views.ts` owns all counting. `VisitorInfo.astro` exposes data attributes for location and cumulative site PV; existing article page-PV IDs stay stable.

- [x] Validate HTTPS/CORS provider response; select the supported response schema.
- [x] Write location data validation tests and browser assertions for local suppression, site PV, article PV, single loader, success/failure/late response; observe failures before implementation.
- [x] Implement provider validation and homepage panel; move counting to shared loader and retain article comments.
- [x] Run unit tests and build; run browser test with intercepted third-party responses, inspect desktop/mobile screenshots.

## Task 2: Documentation and final validation

Files: `README.md`, `scripts/check-build.mjs`, `package.json`, this plan.

- [x] Replace obsolete no-site-count build invariant with homepage-only visibility and per-page shared loader checks.
- [x] Explain terminology, provider behavior, third-party request conditions, historical limits, and same-host counting scope in README.
- [x] Run `npm run verify`, targeted browser checks and existing article-services browser regression.
- [x] Review the final diff; fix material findings; report local delivery state without publishing unless requested.

## Execution record

- Baseline: 86/86 unit tests passed after retrying outside sandbox (Node child processes require escalation).
- Ruling: use a feature branch in the existing clean checkout, preserving installed tools/dependencies; no separate worktree needed for this scoped change.
- User's “可以” accepted the proposed frontend display and existing-service approach; implement directly without another approval cycle.
- Provider: ipapi.co returned HTTP 200 with Access-Control-Allow-Origin matching the production origin. Other candidates timed out or returned 403. Country labels use Chinese Intl.DisplayNames; regions/cities preserve provider spelling.
- Ruling: place the panel below the main homepage introduction because the existing sidebar is hidden on phones; no duplicated panel or requests.
- RED: new unit test initially failed for missing location module; browser test failed because the homepage had no cumulative counter. GREEN: four new location tests and all six browser-check groups passed.
- Full `npm run verify`: 90/90 unit tests; Astro 0 errors/warnings/hints; static build and output checks passed (38 pages, five searchable articles).
- Visual QA: inspected desktop and 320px mobile screenshots; 390px and dark screenshots also generated. Both fields remain visible on mobile without overflow.
- Existing browser smoke: 30 check groups passed, including full article-path referrers and recovery from late page-PV responses. First attempt overlapped a build and lost dist/404.html; rerun after the build passed.
- Final read-only reviewer: no actionable findings. Redirect shells count at their destination; provider quotas, history gaps and same-host totals remain documented external constraints. No deferred code issues.
- Delivery: local changes on `feat/visitor-info`, no commit/push/publish. Unrelated concurrent billiards content was left untouched.

## Follow-up revisions and integration

- User requested a location icon without “你来自”, the exact label “累计浏览量”, and implementation explanations in the existing blog-build article. Completed the UI, accessible location label, README and article updates; refreshed the article update timestamp.
- Revalidation: 90/90 tests passed; Astro diagnostics clean; build and output checks passed. Visitor browser checks passed with the revised SVG icon/text, including 320px and 390px views.
- User subsequently authorized combining both AI windows' changes and pushing to remote `main`. Include `billiards-teaching-20261103.md` and its PNG with the existing `draft: true`; do not publish the draft as part of integrating source files.
- Fetched remote state before integration: local main, feature branch base, and origin/main all at `12776b5`. Full combined-workspace `npm run verify` passed again before committing; production build excludes the billiards draft.
