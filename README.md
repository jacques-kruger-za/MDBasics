# MDBasics

MDBasics is a minimal Windows-focused desktop Markdown editor built with Electron. The current product surface is intentionally code-editor-first: fast native file open/save, polished Markdown shortcuts, export, tabs, and a clean app shell.

## Current Scope

- Native desktop window with custom app top bar
- Markdown file open, save, and save as
- Tabbed documents
- Code editor with Markdown-aware helpers
- Read-only rendered preview
- Read-only diff against the saved/opened version
- Slash command menu for common block types
- Keyboard shortcuts for block conversion and inline formatting
- Code-view table helpers for standard Markdown pipe tables
- Dark/light mode and optional glass background
- Optional line numbers
- Status bar with line, column, character count, path, status, and zoom
- Export to HTML, PDF, and DOCX
- Print support

WYSIWYG editing is intentionally paused. Rendered and Diff are active read-only MVP views.

## Install

```powershell
npm install
```

## Run

```powershell
npm start
```

## Build Installer

```powershell
npm run release:win
```

The Windows installer is written to `dist/`.

## Versioning

MDBasics uses SemVer-style versions. The MVP baseline is `0.1.0`; WYSIWYG work should iterate as `0.2.0-alpha.x` until it is stable enough for `0.2.0`.

See [docs/VERSIONING.md](docs/VERSIONING.md).

## Markdown Shortcuts

Inline formatting:

| Shortcut | Result |
| --- | --- |
| `Ctrl+B` | Bold wrapper: `**text**` |
| `Ctrl+I` | Italic wrapper: `_text_` |
| `Ctrl+U` | Underline wrapper: `<u>text</u>` |

Block commands:

| Shortcut | Block |
| --- | --- |
| `Ctrl+Shift+1` | Heading 1 |
| `Ctrl+Shift+2` | Heading 2 |
| `Ctrl+Shift+3` | Heading 3 |
| `Ctrl+Shift+4` | Quote |
| `Ctrl+Shift+5` | Bullet |
| `Ctrl+Shift+6` | Numbered list |
| `Ctrl+Shift+7` | Task |
| `Ctrl+Shift+8` | Horizontal rule |
| `Ctrl+Shift+9` | Code block |
| `Ctrl+Shift+0` | Paragraph |
| `Ctrl+Shift+T` | Table |

The `/` menu exposes the same block commands with syntax reminders.

## Tables

Tables stay as standard Markdown pipe tables so they export cleanly through Pandoc and remain portable to Obsidian, GitHub, and Notion-style Markdown flows.

Inside a table:

- `Tab` moves to the next cell and creates a new row when needed.
- `Shift+Tab` moves to the previous cell.
- `Enter` inserts a row below and keeps the cursor in the same column.
- `Ctrl+Enter` exits the table.
- Right-click exposes format, row, column, and alignment actions.

## Exports

- HTML and PDF export render Markdown through the app's Markdown pipeline.
- DOCX export uses `pandoc-wasm`, so Pandoc is bundled as an app dependency and does not require a system install.

## Project Structure

```text
index.html              App shell
src/main.js             Electron main process and native dialogs/export handlers
src/preload.js          Safe renderer bridge and Markdown conversion helpers
src/renderer.js         Active code-editor-first renderer
src/styles.css          App styling
src/modules/table-editing.js  Code-view Markdown table editing helpers
src/modules/display.js  Read-only rendered Markdown view
src/modules/diff.js     Read-only line diff view
logs/CHANGELOG.md       Development log
```

## Development Notes

The active editor is a textarea-based Markdown code editor. Rendered and Diff are read-only support views. WYSIWYG editing should be reintroduced deliberately after the core code-editing MVP is stable.
