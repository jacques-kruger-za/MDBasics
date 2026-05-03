# MDBasics

Agent context for working in this repo. Layered on top of the global `~/.claude/CLAUDE.md`.

## What this project is

A minimal Windows-focused desktop Markdown editor built with Electron. Code-editor-first: fast native file open/save, polished Markdown shortcuts, tabbed split panes, slash-command block menu, dark/light + optional glass background, export to HTML / PDF / DOCX, and Windows file association for `.md`, `.markdown`, `.mdown`, `.mkd`. WYSIWYG editing is intentionally paused — preview and the Diff inspector are read-only.

## How to run / develop

- Install: `npm install`
- Dev: `npm run dev` (builds CodeMirror bundle, then launches Electron)
- Verify: `npm run verify` (CodeMirror bundle + `node --check` on main / preload / renderer / modules)
- Build installer: `npm run dist` (electron-builder, Windows NSIS)
- Release: `npm run release:win` (verify + dist)

## Conventions specific to this repo

- Renderer modules live in `src/modules/` (diff, display, table-editing, scroll-sync). Keep them `node --check`-clean — `npm run verify` syntax-checks each one.
- CodeMirror is bundled with esbuild into `src/vendor/codemirror.bundle.js`. Don't import CodeMirror directly in renderer files — go through the bundle entry.
- Logs and smoke-test artifacts (`electron-*.log`, `logs/`) are local-only; don't commit them.

## Gotchas

- Forgetting `build:codemirror` before launching Electron leaves a stale bundle — use `npm run dev` / `npm start`, not raw `electron .`.

## Don't do

- Don't reintroduce WYSIWYG editing into the preview pane — preview is deliberately read-only MVP scope.
- Don't add new dependencies without flagging it first — the whole pitch is "minimal".
