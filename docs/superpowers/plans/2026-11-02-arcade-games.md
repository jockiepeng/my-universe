# Arcade games implementation plan

> **For agentic workers:** Use independent parallel tasks for the three game domains; root owns shared shell and integration. Follow test-driven-development and verification-before-completion.

**Goal:** Add playable snake, minesweeper, breakout and link matching games to the existing lobby.

**Architecture:** Independent pure MJS game logic and TypeScript controllers, shared Astro layout and CSS; Canvas for real-time games and accessible DOM grids for puzzles.

**Tech Stack:** Astro 7, TypeScript, Node test runner, Playwright, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-11-02-arcade-games-design.md`

## Global constraints

- No new dependencies; preserve `/my-universe/` base path, dice and 2048.
- Root alone edits games.ts, lobby, shared arcade files and README; game workers edit only owned files.
- Controls work with keyboard and touch; real-time games stop when hidden; best scores survive reload, storage failure is nonfatal.
- Implement in `.tools/arcade-games-worktree` on `feat/arcade-games`; do not switch, commit, push or clean the user's main worktree.

## Review focus

- Multiple rapid direction inputs cannot reverse into the snake's neck.
- First mine reveal and flood fill respect flags; hidden/paused timers cannot skip elapsed time.
- Ball collisions cannot repeatedly score the same brick or tunnel through a surface.
- Link paths permit exactly two turns and use the outer border; shuffles cannot leave an unplayable board.
- Keyboard focus, mobile controls, narrow grids and disabled storage remain usable.

## Tasks

- [x] Root: shared ArcadeLayout, arcade.css and storage helpers; six-card lobby previews.
- [x] Snake worker: `src/lib/snake.mjs`, `tests/snake.test.mjs`, `src/scripts/snake.ts`, `src/pages/games/snake.astro`, optional `src/styles/snake.css`; test red then green and report API.
- [x] Breakout worker: equivalent breakout-owned files; meaningful collision tests, mouse/touch/keyboard play and lifecycle handling.
- [x] Puzzle worker: minesweeper and link-owned files, pure tests, accessible boards, timer/pause/reset and records.
- [x] Root: update README and script entries, review all domains; complete unit suite, Astro diagnostics, production build and link checks.
- [x] Root: real-browser game interactions and mobile screenshots, review/fix issues, leave concrete playable preview.

## Shared interface

Pages use `ArcadeLayout.astro` props `{title, description, slug}`; default slot is game, named slot `guide` is rules/help. Shared classes: `a-toolbar`, `a-metrics` (dl/div/dt/dd), `a-actions`, `a-button`, `a-surface`, `a-status`, `a-note`, `a-controls`, `a-directions`. Root wrapper has `data-arcade={slug}`. Helpers in `src/lib/arcade-storage.ts`: `readNumber(key,fallback=0)`, `writeNumber(key,value):boolean`, `readJSON(key):unknown|null`, `writeJSON(key,value):boolean`. Game-specific data attributes should use `data-snake-*`, `data-breakout-*`, `data-mines-*`, `data-link-*`. Own pure logic interfaces are defined by each worker's tests and documented on return.

## Verification and review

- Final `npm run verify`: 81/81 unit tests; Astro 0 errors/warnings/hints across 106 files; production build and 496 local resource/link checks pass. Search still indexes only the three published articles.
- Dedicated arcade browser suite passes all six lobby entries, four game flows, timer/physics pause, real touch swipe/drag/taps, gesture cancellation, records, 320/390px light/dark layouts, blocked storage and no-JavaScript help. Existing dice and 2048 browser suites also pass.
- Independent link geometry oracle verifies every 3×3 obstacle pattern and endpoint pair (4,608 boards). Review found sparse-board keyboard navigation could trap focus; added `nextTileIndex` and regressions to make all remaining tiles reachable.
- Real-browser regressions reproduced then verified fixes for mid-round link records, global font reset shrinking icons, suppressed compatibility clicks after canvas drag, and release-outside-button cancellation. `arcade-input.ts` handles short touch releases while preserving keyboard/mouse activation and suppressing duplicate compatibility clicks.
- Desktop and mobile screenshots are in this worktree's `.tools/screenshots/`. Preview runs at `http://127.0.0.1:4322/my-universe/games/`.
- Release scope: four new games, shared lobby/input/storage support, browser and rule tests, README guide and `docs/games-design.md`. Commit from the isolated `feat/arcade-games` worktree and push the verified result to remote `main` as requested; preserve unrelated changes in the main worktree.
