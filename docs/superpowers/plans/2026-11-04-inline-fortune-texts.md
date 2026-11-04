# Inline Fortune Texts Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Read all 196 fortune poems and plain-language interpretations on the local result paper.
**Architecture:** Validated static JSON corpus, existing pure model lookup, existing controller rendering text nodes, scoped responsive styles. No runtime source fetch.
**Tech Stack:** Existing Astro, TypeScript, CSS, Node tests and Playwright.
**Spec:** `docs/superpowers/specs/2026-11-04-inline-fortune-texts-design.md`

## Global Constraints

- Keep Guanyin 100 / Che Kung 96 and history storage v1.
- Use traditional poems, documented per-sign provenance, and clearly labeled independently written interpretations.
- Preserve ritual, motion preferences, keyboard access, storage failure behavior, no automatic navigation or publishing.
- Continue in existing `feat/temple-fortunes` checkout; this is an amendment to the uncommitted feature being previewed.

## Review Focus

- First/final signs and every intermediate number must have text; no random empty results.
- The same number in two collections must use each collection's poem and source.
- Historic results and refresh must resolve the same current-edition poem.
- Render plain text safely and fit long text at 320px without clipping.
- Block external requests during browser checks to prove reading is local.

## Task 1: Complete corpus and model

Files: `src/data/fortune-texts.json`, `src/lib/fortune.mjs`, `tests/fortune.test.mjs`, `docs/fortune.md`.
Interface: `fortuneReading(collection, number)` returns immutable `{number, grade, poem: string[], interpretation, sourceUrl}`; `sourceUrl` uses the same edition's provenance.
- [x] Add failing tests for corpus coverage, representative exact poems, collection isolation, invalid IDs/numbers and immutable lookup.
- [x] Collect only traditional poetry and grade metadata; author each plain-language reading; document sources and edition.
- [x] Implement lookup and source alignment; run full unit suite.

## Task 2: Inline reading and verification

Files: `src/pages/tools/fortune.astro`, `src/scripts/fortune.ts`, `src/styles/fortune.css`, `scripts/fortune-browser-smoke.mjs`, README and previous feature docs.
- [x] Add browser assertions for poem/interpretation visibility, matching history, first/final boundary fixtures, local-only reading, and mobile overflow; see them fail on old page.
- [x] Render grade, four poem lines and interpretation; demote source link to attribution; update all source-related copy.
- [x] Run `npm run verify`, then browser checks; inspect desktop light/dark and mobile screenshots.
- [x] Review final diff and keep live local preview available for user.

## Progress

- Baseline: 124 tests passed. Sandbox initially blocked Node test subprocesses; rerun outside sandbox passed.
- Source research: two complete numbered indexes at zhouyi.cc/lingqian/guanyin/ and /chegong/. Only traditional poems and classification metadata will be transcribed, not the site's modern commentary, images or design. All interpretations are newly written.
- Pre-flight: Task 2 consumes `fortuneReading` and its source URL from Task 1; field names agree.
- Ruling: existing user request directly authorizes this additive change; retain the established working branch and original visual direction without another approval or worktree round. Leave changes uncommitted for preview.
- 2026-11-05 resume: downloaded 196 source pages. Initial extractor assumed poetry precedes grade; 99 Guanyin pages put it after a separate 签诗 label, one has a title space, and two Che Kung pages omit or change a label. Explicit section boundaries fixed extraction; 100 + 96 complete, no parse errors.
- Task 1 model RED → GREEN: 9 tests passed, including exhaustive coverage of 196 readings and immutable results. Original interpretations authored for all 196 poems.
- Task 2 browser RED: old built page fails `完整签诗直接显示在签纸上` as expected. Inline rendering and attribution implemented.
- Final verification: `npm run verify` exit 0; 127 tests passed, Astro 0 errors/warnings/hints, 52 pages built, 1386 internal links/resources checked. Pagefind reports the existing Google verification HTML fragment has no outer html element; the 17 searchable pages and artifact checks pass.
- Browser GREEN: both collections, inline poems/grades/interpretations, first/final signs, redraw, v1 history restoration, animation/skip, keyboard, corrupt/blocked storage, no-JS fallback and 320px/390px layouts pass with external requests blocked.
- Extra 320px three-character-number check initially misread CSS line-height `normal` as a numeric height. Inspection confirmed one text rectangle; changed the test to measure actual text line rectangles. Full browser suite rerun passed. No production fix needed.
- Visual QA: desktop light/dark, mobile 320px and Che Kung #96 reviewed; no clipped text or wrapped sign number. Read-only independent review compared all 196 poems, grades and source URLs against cached pages; no Critical/Important/Minor findings. Other temple editions and Safari/Firefox remain outside this verification.
- Local preview HTTP 200 at `http://127.0.0.1:4321/my-universe/tools/fortune/` with inline-poem markup. Changes were left uncommitted for preview.
- 2026-11-05: user approved the preview and explicitly requested committing and pushing to remote `main`. Proceed with final validation and a normal fast-forward merge/push; this authorization supersedes the earlier preview-only delivery boundary.
