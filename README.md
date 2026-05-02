# MDBasics

MDBasics is a minimal Windows-focused desktop Markdown editor built with Electron. The current product surface is intentionally code-editor-first: fast native file open/save, polished Markdown shortcuts, export, tabs, and a clean app shell.

## Current Scope

- Native desktop window with custom app top bar
- Markdown file open, save, and save as
- Tabbed documents
- Code editor with Markdown-aware helpers
- Slash command menu for common block types
- Keyboard shortcuts for block conversion and inline formatting
- Code-view table helpers for standard Markdown pipe tables
- Dark/light mode and optional glass background
- Optional line numbers
- Status bar with line, column, character count, path, status, and zoom
- Export to HTML, PDF, and DOCX
- Print support

Rendered/WYSIWYG editing and diff are parked behind modules for now. They are not active in the UI while code editing is being stabilized.

## Install

```powershell
npm install
```

## Run

```powershell
npm start
```

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
src/modules/diff.js     Parked diff module
src/modules/wysiwyg.js  Parked WYSIWYG module boundary
logs/CHANGELOG.md       Development log
```

## Development Notes

The active editor is a textarea-based Markdown code editor. WYSIWYG and diff code are intentionally ringfenced so they can be reintroduced deliberately after the core code-editing experience is stable.
