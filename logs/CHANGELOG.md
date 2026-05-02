## 2026-05-02

### Changes
- Reconstructed and added `docs/FOUNDATION_REDESIGN_PLAN.md` from the archived Codex plan.
- Began executing the foundation redesign: app-icon menu, tab-row action controls, parked scroll-sync UI, activity rail with Outline/Search/Recents/Settings, Stats/Diff inspector, persistent settings/recent files IPC, and a dormant `scroll-sync` module boundary.
- Refined the foundation shell spacing: split-pane resize now uses an overlay handle instead of a layout gutter, tab contrast/new-tab placement were tightened, activity pane dock/hover state was separated, inspector resize/collapse controls were adjusted, and editor/scrollbar/icon sizing was tuned.
- Completed a visual foundation polish pass: added shell hairlines, moved pane controls into per-pane menubars, changed parked scroll sync to a disabled lock, added hover animation and pin docking for the action pane, widened and unified scrollbars, tightened inspector typography/diff margins, and aligned tab/inspector/action controls.
- Made Settings on the action strip click-only and aligned the hover activity pane visual treatment with context/menu panels using the same restrained surface, hairline, shadow, and subtle accent selection style.
- Fixed the split-pane separator by removing the competing pane border and making the resize handle draw the single visible hairline from below the pane menubar to the status strip.
- Simplified shell boundary ownership: the action strip now spans the full workspace height, the status strip remains its own resizing object, docked activity panes use only an integrated separator, floating panes/menus share one surface language, and tab plus/close controls were enlarged and center-aligned.
- Restored tab/body cohesion by removing the active-tab accent border, lightening the active tab surface, letting the active tab cover its bottom hairline, removing the pane menubar boundary line, extending the split-pane hairline as an overlay, moving the floating action pane closer to the rail, and centering the Settings dialog across the workspace.
- Tuned the active tab/open-document surface to a 2.5% lift over inactive tabs, removed tab hover fill, gave pane menus 2px more vertical breathing room, corrected floating activity-pane offset to sit 4px from the action strip border, and logged the future collapsed pane-menu handler idea.
- Added glowing accent dots for the active pane and dirty tabs, changed tab close icons to fade in only on tab hover/focus while replacing the dirty dot, and added a native unsaved-document close warning with Save, Don't Save, and Cancel choices.
- Fixed line-number gutter behavior for wrapped code lines by giving line-number rows estimated visual heights, preserving a fixed gutter whether numbers are shown or hidden, adding 5px more gutter/text spacing, and refreshing line-number geometry after pane, inspector, activity, and window resize changes.
- Simplified the textarea line-number gutter back to stable logical line numbers after stress testing showed visual-row estimation breaks under heavy resize and zoom; precise wrapped-line gutters are now explicitly scoped to the CodeMirror migration.
- Moved the optional formatting toolbar out of the app top bar and into each code pane menubar, aligned pane controls to the editor text column, and kept formatting controls hidden unless the pane is in Code view and the setting is enabled.
- Consolidated shell CSS tokens for chrome surfaces, tabs, document canvas, action strip, inspector, status strip, hairlines, resize lines, hover tints, and active accents without changing the intended visual foundation.
- Removed redundant hidden document-toolbar and topbar pane-control wiring now that split/view/sync controls live in each pane menubar.
- Hardened hidden PDF/print windows so failed export or print setup cannot leave an offscreen BrowserWindow open.
- Added CodeMirror 6 as the Code pane editor through a bundled adapter, preserving open/edit/preview/split-pane state and routing existing Markdown editing tricks through CodeMirror-backed selections and transactions.
- Replaced the fragile textarea line-number gutter with CodeMirror gutters while keeping the editor text column stable when line numbers are hidden.
- Added `docs/CODEMIRROR_EDITING_MAP.md` to track how bold, italic, underline, headings, tables, right-click menus, slash commands, and the formatting toolbar map onto the new editor engine.
- Fixed first-pass CodeMirror regressions: transparent pane-matched gutters, fixed-size line numbers under zoom, subtle accent active-line tint, app-standard scrollbars, and stable textarea-style selection setters for existing formatting/Tab/Enter commands.
- Enabled official `@codemirror/lang-markdown` keymap and commands explicitly so Markdown continuation/deletion behavior uses the CodeMirror package as the compatibility baseline before MDBasics fallbacks.
- Added `markdown-commands.js` for CodeMirror transaction-based inline and line editing, then rewired renderer formatting, table, slash, and insertion helpers to delegate to those commands when CodeMirror is active.
- Added `markdown-rich-view.js` for hybrid Markdown decorations: bold, italic, headings, inline code, and syntax-marker fading outside the active cursor context.
- Extended inline-format exit behavior to underline, strikethrough, backticks, quotes, square brackets, parentheses, braces, and angle brackets.
- Refined inline-format exit behavior so single Space stays inside formatting, while Tab, Enter, repeated closing character/format command, right-click, and double Space exit the wrapper.
- Updated Enter while exiting inline formatting so it keeps the current block context, such as bullet, numbered, task, or quote, and leaves block exit to the next empty Enter.
- Normalized Enter behavior for quote blocks, fenced code blocks, and tables: continue the structure from populated content and exit on the next empty structure line/row.
- Added list indentation with Tab/Shift+Tab and table cell navigation with Ctrl+Arrow keys.
- Fixed Enter handling priority so raw code fences create a closing fence and quotes/fenced code exit on the second Enter from an empty continuation line.
- Moved MDBasics key handling into CodeMirror's event pipeline ahead of Markdown keymaps and removed the redundant blank exit line from fenced code blocks.
- Disabled CodeMirror backtick auto-pairing so manually typed code fences remain three backticks, and renumbered ordered-list blocks after Tab/Shift+Tab indentation changes.
- Preserved explicit CodeMirror cursor targets through the renderer `replaceRange` wrapper so manual code-fence insertion lands inside the fenced block.
- Made inline Space handling stateful so single Space stays inside formatting and only a second consecutive Space exits the wrapper.
- Changed double-Space inline-format exit to remove the first typed space instead of leaving it inside the wrapper.
- Preserved one outside separator space when double-Space exits inline formatting.
- Added Markdown-aware backtick handling so paragraph backticks create/exit inline code while empty-line backticks remain raw for fenced code blocks.
- Added a shared block-exit spacing normalizer so lists, quotes, fenced code blocks, and tables exit with one markdownlint-friendly blank separator before normal editing resumes.
- Extended block spacing normalization to headings and horizontal dividers for both slash/toolbar insertion and manual Enter from the block line.
- Expanded the foundation roadmap to make visual richness explicit across app display variants, editor representation profiles, preview/export presentation profiles, density presets, and syntax-marker visibility modes.

### Health Checks
- Ran `npm run verify`.
- Ran `git diff --check`.
- Restarted the Electron dev app after the spacing and docking pass; no stderr was emitted.

### Notes
- CodeMirror 6 replacement is still the next major implementation slice; this pass keeps the textarea editor while reshaping the app shell and persistence foundation.

## v0.1.2 - 2026-05-02

### Changes
- Added a document toolbar below tabs for single/split layout, active pane selection, pane Code/Preview mode, pane sync, and Diff inspector controls.
- Replaced the single editor surface with per-tab pane state so each document remembers layout, active pane, pane view, pane cursor, pane scroll, and sync lock.
- Added editable dual Code panes backed by the same document text while preserving independent pane cursor and scroll state.
- Moved Diff out of the main view modes into a global right inspector whose content follows the active tab.
- Added block-anchored Markdown preview and source-line diff rows for MVP pane and inspector sync.

### Health Checks
- Ran syntax verification and npm audit.
- Rebuilt the Windows installer as `MDBasics-0.1.2-Setup-x64.exe`.

## v0.1.1 - 2026-05-02

### Changes
- Added Windows installer file associations for `.md`, `.markdown`, `.mdown`, and `.mkd`.
- Added single-instance file-open handling so opening a Markdown file from Explorer routes into the existing app window.

### Health Checks
- Ran syntax verification and npm audit.
- Rebuilt the Windows installer as `MDBasics-0.1.1-Setup-x64.exe`.

## v0.1.0 - 2026-05-02

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
- Replaced the parked WYSIWYG module with a read-only display module and reactivated Rendered and Diff as MVP read-only views.
- Fixed view switching by enforcing hidden panes at app CSS level so the code editor no longer overrides the hidden attribute.
- Added Electron Builder packaging for a local Windows NSIS installer.
- Added SemVer release guidance, versioned installer artifact names, and a WYSIWYG prerelease path for `0.2.0-alpha.x`.

### Health Checks
- Installed dependencies and upgraded Electron to 41.4.0 to clear npm audit advisories.
- Ran JavaScript syntax checks and an Electron launch smoke test.
- Verified `html-to-docx` can generate a valid DOCX buffer and reran npm audit with zero vulnerabilities.

### Notes
- `v0.1.0` is the MVP baseline.
- WYSIWYG editing is paused for `0.2.0-alpha.x` iteration builds.
- Markdown preview HTML is sanitized before rendering.
- PDF and print use Chromium rendering so output tracks the rendered Markdown view.
