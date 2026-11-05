# English Interface Implementation Plan

> Execute with the existing Astro/TypeScript toolchain. Parallel translation domains have disjoint ownership; integrate and verify together.

**Goal:** Support English throughout the interface with a persistent upper-right language switch, preserving blog content.

**Architecture:** Exact and parameterized translation catalogs, an in-place DOM adapter with explicit content exclusions, and a direct translation API for canvas and external widgets.

**Tech Stack:** Astro, TypeScript, JavaScript modules, Node test runner, Playwright.

**Spec:** ../specs/2026-11-05-english-ui-design.md

## Constraints and review focus

- Default Chinese; accept only zh/en preferences; unavailable storage must not break switching.
- Article prose, titles, excerpts and user input must retain their original content.
- Switching must preserve game state and active tool forms; asynchronous UI stays in the selected language.
- Keep attribute values used as identifiers and filter keys unchanged.
- Verify at 320px and desktop, including long English labels and canvases.

## Tasks

- [x] Add unit tests for catalog matching, interpolation and fallback; observe failure, then implement src/lib/i18n.mjs.
- [x] Add public, games, tools and reading catalogs; translate non-DOM output via t(text).
- [x] Add the visible switch and src/scripts/language.ts; mark article/user content boundaries and update comment locale.
- [x] Add browser checks for persisted navigation, switching back, article preservation, dynamic UI, blocked storage, complete UI coverage and mobile overflow.
- [x] Run tests, Astro check/build and browser verification; inspect screenshots and resolve review findings.

## Verification

- 137 Node tests pass, including complete coverage of the 196 English fortune readings and the 200-entry English quote pool.
- Astro check: 166 files, no errors, warnings or hints. Build: 56 pages. Artifact validation: 18 searchable documents, no draft leakage.
- English browser checks cover all 56 routes; no untranslated non-editorial UI remains. Tested 320/390/768/1024px layouts, persisted navigation, disabled storage, cross-tab changes with search open, article and wish preservation, dice/fortune/tool state, PNG canvas text, and English first-load particle text.
- Existing full-site Chinese browser regression passes. Screenshots inspected for the English home page, fortune results and life posters.
- Review fixes: translated carousel role descriptions; localized complete search descriptions through Pagefind metadata instead of arbitrary snippets; localized particle text before the initial DOM translation.
- The existing Pagefind warning is the standalone Google verification HTML file, which intentionally has no document wrapper and is not indexed.
