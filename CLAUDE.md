# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

fangkejia-pro is a Cursor-like desktop GUI wrapping Claude Code CLI. v1 is being built milestone-by-milestone.

- **M1 (完成)** — Electron + Vue 3 + TypeScript scaffold, IPC plumbing, four-pane layout placeholders, path-sandbox + logger utilities. Tagged `m1-done`.
- **M2-M7 (planned, not yet implemented)** — See `docs/superpowers/plans/` for per-milestone implementation plans. M2 plan already written; M3-M7 will be written before each is executed.

**Before implementing anything**, read the corresponding section of `docs/superpowers/specs/2026-04-21-fangkejia-pro-design.md`. The spec and plans are the source of truth — do not invent scope the spec doesn't call for.

## Dev Commands

```bash
npm run dev                          # Electron dev mode (HMR)
npm test                             # Run all Vitest unit tests
npm test -- tests/unit/foo.test.ts   # Single test file
npm run test:watch                   # Watch mode
npm run typecheck                    # vue-tsc strict check (no emit)
npm run build                        # Production bundle → out/
npm run build:win                    # Windows installer via electron-builder (M7 scope)
```

## Architecture (the parts you cannot discover by reading one file)

### Electron dual-process model

- `src/main/` — Node.js main process. All fs, SQLite, Agent SDK, file-snapshot code lives here. Only this side has file system access.
- `src/preload/` — Sandboxed preload script, loaded by the renderer. Uses `contextBridge.exposeInMainWorld('api', ...)` to expose a strongly-typed, minimal IPC surface. Runtime format **must be CommonJS** (see build quirk below).
- `src/renderer/` — Vue 3 UI. No Node access. Communicates with main exclusively via `window.api` (preload-injected).
- `shared/` — Imported by both main and renderer. Contains `ipc-channels.ts` (channel name constants) and `types.ts` / `events.ts` (DTOs). **Never put executable code here** — only types and constants. This is the contract that keeps the two processes in sync.

### Critical build quirk: preload extension is `.cjs`

`package.json` has `"type": "module"` so `.js` files resolve as ESM. Electron's sandboxed preload requires CommonJS. `electron.vite.config.ts` therefore emits the preload bundle as `out/preload/index.cjs` (`rollupOptions.output = { format: 'cjs', entryFileNames: '[name].cjs' }`), and `src/main/index.ts` references `'../preload/index.cjs'`. **Do not change either half in isolation.**

### Adding a new IPC call requires touching four places

1. `shared/ipc-channels.ts` — add the channel name constant
2. `shared/types.ts` (or `shared/events.ts`) — add request/response types
3. `src/main/ipc/handlers.ts` — register the handler with `ipcMain.handle(...)`. Keep the business logic as a pure function (testable without Electron) and have `registerIpcHandlers` wire it.
4. `src/preload/index.ts` — add a typed method on the `api` object, re-export type

Pub/sub channels (`webContents.send`) also need renderer-side subscribe/unsubscribe helpers on the preload `api`.

### Three invariants that are easy to violate

These are enforced by code / plans in later milestones but must be respected when anyone modifies the codebase:

1. **Rollback touches only files the AI modified in that specific turn.** See `docs/superpowers/specs/...#§6.2` and the `project_rollback_safety.md` auto-memory. A whole-workspace snapshot is a data-loss bug. Snapshot logic lives in `src/main/services/snapshotStore.ts` (M5).
2. **All SDK-originated Markdown must pass through `renderMarkdown()`** (`src/renderer/utils/markdown.ts`, M2). Never bind raw SDK text via `v-html`. DOMPurify + `markdown-it` with `html: false` is the only allowed render path.
3. **All fs-related IPC handlers must run user-supplied paths through `sandbox()`** (`src/main/utils/path-sandbox.ts`, M1). Any handler that takes a path without sandboxing is a path-traversal bug.

### Provider abstraction (M2+)

`AgentProvider` interface (`src/main/providers/AgentProvider.ts`) decouples CC integration from the bridge. v1 ships only `ClaudeCodeProvider` (wraps `@anthropic-ai/claude-agent-sdk`), but `ccBridge` depends on the interface, so a future `CodexProvider` etc. plugs in without bridge changes. Event format is normalized via `NormalizedEvent` in `shared/events.ts`.

### UI layout

Four-pane horizontal: ActivityBar (48px) · SidePanel (220px, file tree + session list stacked) · MonacoPane (flex 1.2, v1 read-only) · ChatPanel (flex 1.3). `App.vue` is the flex container; `StatusBar` lives below; `BashApprovalDialog` is a top-level overlay (M2+).

## Testing

- Vitest; Node environment by default, jsdom overridden per-file via `environmentMatchGlobs` in `vitest.config.ts` (markdown tests need DOM for DOMPurify).
- Pure modules (`path-sandbox`, `logger`, `handlePing`, `mapSdkEventToNormalized`, `renderMarkdown`, `useChatStore`) are covered by unit tests.
- Electron runtime bits (main entry, BrowserWindow creation, IPC wiring) are verified by manual smoke test, not automated. E2E (Playwright) is out of v1 scope.
- `snapshotStore` (M5) has the tightest test burden — 11 required cases listed in the spec §10.

## Git workflow

- Commit per Task (small atomic commits) with semantic prefixes: `feat(scope):`, `fix(scope):`, `chore:`, `test:`, `docs:`.
- `master` is the only long-lived branch; milestone tags (`m1-done`, `m2-done`, …) mark stable points.
- Remote: `https://github.com/wdfkst/claude-code-gui.git` (private).
- `.superpowers/` and `.claude/` are gitignored — they're session artifacts, not project source. Do not `git add -A`; stage explicit files.

## User context

User is comfortable with Vue 3 but has no React experience — do not suggest React-based libraries or wrappers. Prefer Vue-native options (e.g., `monaco-editor-vue3` over React wrappers for Monaco). See `memory/user_frontend_experience.md`.
