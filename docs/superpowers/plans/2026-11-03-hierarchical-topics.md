# Hierarchical Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace old categories with hierarchical topics and add a left-side, site-wide filter to the home page.

**Architecture:** A shared topic configuration defines Chinese category paths and stable English URLs. Static routes provide no-JavaScript navigation; a scoped browser enhancement filters all published home-page entries, preserving the initial paginated view when filters are cleared. A reusable recursive navigation renders the same hierarchy on home, archive and category pages.

**Tech Stack:** Astro 7, TypeScript, native JavaScript, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-hierarchical-topics-design.md`

## Global Constraints

- No new dependencies. Keep article URLs, text and image paths stable.
- Categories: 技术, 技术/AI, 技术/Go, 技术/数据库, 生活, 生活/人际关系. No 随想 category.
- Desktop category tree appears left of home articles; mobile tree appears above articles.
- Parent topics include descendants; hidden empty topics do not appear in navigation.
- Filters apply across all published articles and compose with article/photo kind.
- Preserve existing unrelated workspace changes and do not push or publish.

## Review Focus

- Prefix collisions such as 技术/AI and 技术/AI工具 must not overlap.
- Off-page entries must be found by either category or kind, with pagination restored on reset.
- Empty category/kind combinations must show a useful empty state and correct count.
- Query state must survive refresh and back/forward; modified clicks retain real links.
- Mobile, keyboard use, dark/light scenes and no-JavaScript navigation must work.

### Task 1: Topic model and content migration

**Files:** Create `src/lib/topics.mjs`, `tests/topics.test.mjs`; modify `src/lib/content.mjs`, `tests/content.test.mjs`, `src/content.config.ts`, four existing post frontmatters.

**Interfaces:** `categories: string[]`; `categorySlug(path): string`; `categoryBreadcrumbs(path): Topic[]`; `matchesCategory(path, selected): boolean`; `filterPosts(posts, {category, kind}): Post[]`; `topicTree(posts): TopicNode[]` with `{path, label, slug, count, children}`.

- [x] Write tests for exact/descendant/prefix matching, compound kind selection, parents with no direct posts, empty/draft-safe navigation using published input, valid URLs and unknown category rejection. Run with portable Node; confirm expected failures before implementation.
- [x] Implement shared model and schema validation; migrate three articles to 技术/AI and the photo post to 生活/人际关系. Update old category tests to new stable URLs.
- [x] Run the complete Node suite and confirm it passes.

### Task 2: Left category tree and scoped site-wide filters

**Files:** Create `src/components/TopicTree.astro`, `src/components/PostFilters.astro`, `src/scripts/post-filters.ts`, `scripts/topics-browser-smoke.mjs`; modify `HomeContent.astro`, `PostList.astro`, `appearance.ts`, `global.css`.

**Interfaces:** Filter scope contains `[data-topic-filter]` real links, `[data-filter]` kind buttons, posts with category/kind/initial visibility, live count, empty state and optional pagination. `TopicTree` consumes Task 1 nodes, active category and inline-filter flag.

- [x] Add browser checks for left placement, root and child selection, compound filters and empty state, URL refresh/back state, mobile and no-JavaScript fallback. Confirm the built baseline lacks the new navigation before implementing.
- [x] Keep the existing palette and font: background #f6f8fc/#101d35, text #22324a/#e8edf5, muted #5d6d83/#a6b4ca, accent #315c9d/#9bc4ff. Use a quiet indented tree with an active background, counts aligned right, and the current article typography. Desktop uses a 180px left rail and flexible article column; mobile uses wrapping topic rows above the list.
- [x] Render all published home entries, marking initial-page entries for default visibility. Filter selected category and kind together; hide pagination while active; restore on reset. Store category slug and kind in query parameters with history navigation.
- [x] Move the existing about/tag sections into the left rail below category navigation; keep the category tree visible on mobile while hiding optional sidebar material.
- [x] Run browser checks after production build, injecting a hidden off-page article into an isolated browser response to verify discovery and reset without modifying published content.

### Task 3: Static navigation, compatibility and verification

**Files:** Replace `src/pages/categories/[category].astro` with `[...category].astro`; modify `ArticleMeta.astro`, `archive.astro`, `sitemap.xml.ts`, `docs/writing.md`, `README.md`.

**Interfaces:** Nested static category routes use shared slugs and aggregation; legacy daily/thoughts/practice URLs redirect to life/life/technology with an ordinary fallback link. RSS already emits the category string and requires no code change.

- [x] Use shared breadcrumbs in metadata and category pages. Generate configured category pages, show child navigation and scoped kind filters. List active topics in sitemap and retain legacy static redirects.
- [x] Update writing templates and taxonomy documentation, noting category paths versus keyword tags.
- [x] Run `npm test`, `npm run check`, `npm run build`, `node scripts/check-build.mjs` and the topic browser smoke test. Inspect desktop/mobile screenshots and review the complete diff.
- [x] Obtain a fresh final code review, address important findings, rerun affected verification, and leave changes reviewable in the shared workspace.

## Results

86 tests pass after the template regression fix; Astro reports 0 errors/warnings/hints. Production build and internal links pass validation. The topic browser test includes category and kind-only off-page discovery, pagination hide/reset, modified-click fallback, refresh/back/forward, empty combinations, keyboard input, 320/390px layouts, no-JavaScript navigation and legacy redirect. Existing whole-site browser smoke also passes. Independent review found one authoring-template issue, reproduced and corrected; no other Critical/Important findings. Changes remain uncommitted and unpublished in the shared workspace.

## User correction: separate primary and child filters

The user rejected placing all levels and original right-sidebar content in the left rail. This explicit correction supersedes Task 2's sidebar arrangement: left rail now renders only “全部 + 一级分类”; selecting a primary category reveals its “全部 + 子分类” row above the article list. Original right-side about, theme links and tags are restored. The main list heading stays unchanged. Child selections preserve the active primary root, switching roots resets to that root's all selection, and choosing global all hides the child row. A dedicated `SubcategoryFilters.astro` component renders child rows; `TopicTree` supports roots-only mode. The revised browser test first failed because the original sidebar was missing, then passed after correction; full verify passes (86 tests, zero Astro diagnostics, 750 links).

Expanded responsive checks to 900/760/640/581/390/320px. At 640px the new left rail compressed kind-filter labels into multiple lines; a browser range-rectangle assertion reproduced the failure. Moving only the root rail above existing content at <=900px fixes it while preserving the original right-sidebar breakpoints. The expanded browser suite passes and tablet screenshot is verified.
