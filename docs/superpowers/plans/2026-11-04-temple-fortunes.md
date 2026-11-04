# Temple Fortunes Implementation Plan

> Historical first-version plan. Inline poems and interpretations supersede the source-link-only scope below; see `2026-11-04-inline-fortune-texts.md`.

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visually designed Guanyin / Che Kung drawing experience, referencing the selected official collection.
**Architecture:** Pure selection and history helpers; Astro page and SVG component; TypeScript controller and scoped CSS. Official poems remain on their source pending authorization.
**Tech Stack:** Existing Astro, TypeScript, SVG, CSS, Node test runner, Playwright.
**Spec:** `docs/superpowers/specs/2026-11-04-temple-fortunes-design.md`

## Global Constraints

- Guanyin 100, Che Kung 96; retain original source, never invent grades or poetry.
- No backend, dependencies, automatic external navigation or production deployment.
- Use site's base-path helper, appearance preferences, navigation, and search convention.
- Original art, responsive at 320px, keyboard access, reduced motion, storage failure resilience.

## Review Focus

- Repeated clicks or changing collection during animation must not create mixed results.
- Malformed saved data must not provide markup or external URLs.
- Off-by-one draws must not exclude final sign or generate sign zero.
- Reduced motion and disabled storage must remain fully usable.
- First load without JavaScript must have working official-source links.

## Task 1: Drawing and source model

Files: `src/lib/fortune.mjs`, `tests/fortune.test.mjs`.
Interfaces: `collections`, `chineseNumber(number)`, `sourceUrl(collection, number)`, `drawFortune(collection, random32, now)`, `restoreHistory(raw)`, `addHistory(history, record)`.
- [x] Write failing tests for ranges, official query parameters, random rejection, Chinese numbering, invalid history, latest-first bounded history.
- [x] Implement helpers; verify `node --test tests/fortune.test.mjs` passes.

## Task 2: Page and ritual

Files: `src/components/FortuneTube.astro`, `src/pages/tools/fortune.astro`, `src/scripts/fortune.ts`, `src/styles/fortune.css`; update home and tools index.
- [x] Add a browser smoke test for route, draw/reveal, reload, changing collection, storage failures, reduced motion and mobile overflow. Verify missing feature fails.
- [x] Build original two-theme SVG tube, animated stick and paper, accessible controls, history and original-source links.
- [x] Test compiled page at desktop and mobile; inspect screenshots and correct issues.

## Task 3: Integration and verification

Files: `scripts/fortune-browser-smoke.mjs`, `package.json`, `README.md`, `docs/fortune.md`.
- [x] Document source scope and behavior; add browser command.
- [x] Run full unit suite, Astro check/build and artifact link checker.
- [x] Run browser smoke test; review changed files independently before delivery.

## Progress

- Baseline: clean checkout; 118 tests passed. Created `feat/temple-fortunes` in the shared workspace to keep changes reviewable without copying the repository.
- Authorization question pending; UI/model are independent of poem reproduction. No protected source corpus copied.
- Model RED → GREEN: 6 cases. Browser RED: route 404 before implementation; then full flow passed.
- Verification: 124 tests passed, Astro 0 diagnostics, 52 pages built, 1387 internal links checked. Browser desktop/mobile, storage blocked/corrupt, no-JS, full/reduced animation and keyboard passed.
- Independent read-only review: no Critical/Important defects; homepage color mismatch corrected during visual QA. Review deferred source authorization to user and live redirects/screenshots to main agent. Main verified final Guanyin #100 and Che Kung #96 redirects return HTTP 200.
- Ruling: user delegated visual/interaction design, so implement reviewable local UI without another design-approval round. Full source reproduction remains pending written authorization; no publishing performed.
