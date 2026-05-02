## 2026-05-02

### Changes
- Scaffolded MDBasics as a minimal Electron Markdown editor.
- Added tabbed document editing, native open/save dialogs, code/rendered view switching, dark/light mode, optional glass background, and a compact settings panel.
- Chose GFM/CommonMark-style Markdown as the portable baseline for Obsidian, GitHub, and Notion-adjacent workflows.
- Added print plus HTML, PDF, and Word export.
- Added per-document undo/redo history and a diff view against the state immediately before the latest edit.
- Reworked the app surface so code, rendered preview, diff, tabs, toolbar, and status bar share the same background.
- Wired the in-app File/Edit/View menu buttons and parented native open/save dialogs to the app window.
- Added status-bar feedback for open/save/export/print success, cancellation, and failures.
- Restored the standard native Windows frame so minimize, maximize, close, and resizing use OS-native controls.
- Fixed the Electron preload bridge by disabling renderer sandbox for the app window while keeping context isolation and node integration protections.
- Reworked the window into a VS Code-style hidden-titlebar layout with app icon, menus, and Code/Rendered/Diff toggle in the top line.
- Removed the duplicated toolbar and moved file, edit, export, print, display, and settings actions into the top menu.
- Added an empty state when all tabs are closed.
- Replaced DOCX export with Pandoc-based Markdown-to-DOCX conversion.
- Added editor-local Tab behavior for code and rendered editing, including table-cell navigation in rendered tables.
- Added `pandoc-wasm` as a project dependency and changed DOCX export to use bundled Pandoc instead of system PATH Pandoc.
- Replaced the rendered editor internals with Toast UI Editor for mature WYSIWYG Markdown editing, including better table and formatting behavior.
- Added DOMPurify override for Toast UI so npm audit remains clean.
- Added compact icon-only Code/Rendered/Diff controls, removed the top-bar title text, and removed the border around the new-tab plus button.
- Added hover-responsive top menus, editor context menus, and code-view slash commands for line type conversion.
- Fixed menu startup regression by guarding Toast UI initialization so editor startup failures cannot prevent menus and file-open handlers from binding.
- Changed top-menu activation to pointerdown for more reliable response inside the custom draggable title bar.
- Replaced top HTML dropdowns with native Electron popup menus for reliable click/release behavior and command execution.
- Added slash-command keyboard navigation with ArrowUp, ArrowDown, Enter/Tab selection, and Escape close.
- Restored custom top menus with reliable pointerdown activation so hover-to-adjacent-menu behavior works again.
- Improved code editor Markdown behavior: Enter continues lists/quotes/tasks, empty repeated markers exit blocks, numbered lists increment, code fences keep plain newlines, slash code blocks place the cursor inside the block, and Ctrl+B/Ctrl+I/Ctrl+U wrap selections.
- Positioned the slash command menu at the textarea caret, added a slash line-break command, and fixed task-list Enter continuation.
- Clamped slash menu placement inside the visible window and changed the slash line command to insert a Markdown horizontal rule block.
- Improved inline formatting wrappers in code view so empty Ctrl+B/Ctrl+I/Ctrl+U activations place the cursor inside markers and Space/Enter exits the wrapper cleanly.
- Fixed PDF/HTML task-list rendering so exported task items show the checkbox without an extra bullet marker.
- Made slash command popup capture printable typing as in-menu search/filter input instead of editing the underlying Markdown.
- Added typeahead search for open top menus and changed slash search to prioritize prefix matches before substring matches.
- Added Markdown syntax and Ctrl+Shift shortcut hints to the slash command menu, plus direct Ctrl+Shift+1 through Ctrl+Shift+0 block shortcuts in code view.
- Refactored the app back to a code-editor-first renderer and parked WYSIWYG/diff behind separate module files.
- Removed inactive Toast UI runtime loading and dependency while preserving a WYSIWYG module boundary for later reactivation.
- Simplified active UI behavior so Rendered and Diff are disabled/parked instead of partially active.
- Added optional line-number gutter, cursor line/column plus character count in the left status bar, and editor zoom display/control via Ctrl+mouse wheel.
- Replaced default starter Markdown content with non-persistent ghost text covering common blocks and inline formatting examples.
- Added code-view Markdown table helpers: `/table`, `Ctrl+Shift+T`, Tab/Shift+Tab cell navigation, Enter row insertion, Ctrl+Enter table exit, right-click row/column/alignment actions, and table formatting.
- Cleaned up the code-editor context menu into copy/paste, formatting, and a table submenu, and fixed table Tab navigation to land at the start of the next cell.
- Removed dead native popup-menu IPC from the earlier menu experiment, trimmed unused diff-era document state, and made insertion cursor placement explicit.
- Fixed slash command menu boundary handling after filtering and keyboard navigation so long menus stay visible near the bottom of the editor.
- Fixed context submenu boundary handling so the Tables submenu is clamped to the visible window and scrolls internally if needed.
- Reworked context submenu positioning to stay anchored to the trigger row while choosing left/right and up/down from available viewport space.
- Moved context submenus to body-level floating panels so viewport coordinates are not distorted by the filtered parent menu.

### Health Checks
- Installed dependencies and upgraded Electron to 41.4.0 to clear npm audit advisories.
- Ran JavaScript syntax checks and an Electron launch smoke test.
- Verified `html-to-docx` can generate a valid DOCX buffer and reran npm audit with zero vulnerabilities.

### Notes
- Rendered editing converts edited HTML back to Markdown for file portability.
- Markdown preview HTML is sanitized before rendering.
- PDF and print use Chromium rendering so output tracks the rendered Markdown view.
