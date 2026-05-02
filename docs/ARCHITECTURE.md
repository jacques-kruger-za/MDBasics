# Architecture

MDBasics is currently optimized around a code-first Markdown editing flow.

## Runtime Pieces

- `src/main.js`: owns the Electron window, native file dialogs, print, PDF export, HTML export, and DOCX export.
- `src/preload.js`: exposes a small `window.mdb` bridge to the renderer while keeping node integration disabled.
- `src/renderer.js`: owns the active app state, tabs, code editor behavior, menus, status bar, and export actions.
- `src/modules/table-editing.js`: owns code-view Markdown table parsing, formatting, navigation, and row/column edits.
- `src/modules/display.js`: owns read-only Markdown preview rendering.
- `src/modules/diff.js`: owns read-only line diff rendering against the saved/opened document baseline.
- `src/styles.css`: owns visual styling for the shell, editor, menus, slash menu, tabs, and status bar.

## View Model

MDBasics has one document source of truth per tab. Each tab can render one or two document panes. Each pane can be editable Code or read-only Preview. The right inspector is separate from document panes and currently hosts the read-only Diff tool.

WYSIWYG work should happen in `0.2.0-alpha.x` releases until Markdown round-tripping is stable enough for `0.2.0`.

## Markdown Conversion

- Markdown to HTML: `marked`, sanitized with `sanitize-html`
- HTML to Markdown: `turndown`
- DOCX export: `pandoc-wasm`
- PDF export: Chromium `printToPDF` through Electron

## Code Editor Behavior

The current code editor is textarea-based and implements app-level Markdown ergonomics:

- Slash menu for block conversion
- `Ctrl+Shift+number` block shortcuts
- inline formatting wrappers
- list, task, quote, and code-fence Enter handling
- Markdown pipe-table insertion, cell navigation, row/column edits, alignment, and formatting
- optional line numbers
- line/column/character status
- zoom through `Ctrl+mouse wheel`

## Read-Only Views

- Preview panes: sanitized Markdown preview generated from the active document, with source-line block anchors for sync.
- Diff inspector: line diff between the current document text and the last opened/saved text.
