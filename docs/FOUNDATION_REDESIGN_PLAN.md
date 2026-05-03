# MDBasics Foundation Redesign Plan

## Summary
Rework MDBasics around a stable native-feeling shell, persistent settings, always-visible activity bar, CodeMirror 6 editor foundation, and parked scroll sync. The app remains Markdown-code-first; WYSIWYG and scroll anchoring are deferred.

## Implementation Tracker

Last updated: 2026-05-03

### Completed In Current Foundation Build
- Native-feeling shell baseline: app-icon menu, top tab strip, share/export entry point, inspector toggle, action strip, status strip, shell hairlines, and native window-control alignment.
- Tab visual foundation: active/inactive tab contrast, no active-tab accent underline, close icon appears on hover/focus, dirty dot appears for unsaved documents, and unsaved close warning prompts Save / Don't Save / Cancel.
- Activity strip and pane: Outline, Search, Recents, Settings; hover expansion; dock/pin behavior; resizable docked pane; persisted width and last selected tool.
- Settings overlay: app-level modal overlay, click-only Settings activation, theme/accent/glass/editor/preview/font/editor options, and parked scroll-sync setting.
- Pane layout foundation: single/split panes, independent Code/Preview state per pane, active pane glow dot, split-pane resize handle, pane controls in pane menubar, and unsplit preserves the pane where the action was triggered.
- Formatting toolbar placement: optional toolbar moved into each code pane menubar; hidden unless `Show formatting toolbar` is enabled and that pane is in Code view.
- Inspector foundation: Stats and Diff modes, app-level right inspector, resizable inspector width, changed-only Diff toggle, and outline moved out of inspector.
- Parked scroll sync: runtime sync behavior disabled, dormant `src/modules/scroll-sync.js` boundary added, disabled lock icon shown in pane menubar, and disabled Settings item added.
- Empty state: larger logo and Open Document / New Document options when no document is open.
- Visual cleanup pass: action strip/status strip boundary ownership, floating menu shared styling, subdued hover accents, widened minimal scrollbars, and activity-pane hover position corrected.
- Shell CSS token cleanup: app chrome, document surface, active/inactive tabs, action strip, inspector, status strip, shell hairlines, resize hairlines, hover tints, active accents, and muted text now route through named shell tokens while editor syntax tokens remain deferred to CodeMirror.
- CodeMirror 6 first pass: Code panes now mount CodeMirror through a bundled adapter, preserve open/edit/preview/split-pane document state, use CodeMirror gutters for line numbers, and keep the existing Markdown edit tricks routed through the adapter.
- Official `@codemirror/lang-markdown` is now the authoritative Markdown baseline: parser, fenced-code language support, Markdown keymap, list/blockquote continuation, and markup deletion are enabled explicitly before MDBasics custom fallbacks.
- Added CodeMirror-native Markdown modules: `markdown-commands.js` owns editor transactions for inline/line edits, and `markdown-rich-view.js` owns visual Markdown decorations for bold, italic, headings, inline code, and syntax-marker fading.
- Visual richness first pass: Settings now exposes app display variants, editor Markdown style, preview/export style, density, syntax-marker visibility, editor font, and preview/export font; CSS classes make each profile visibly affect the shell, editor, or preview while preserving the current default look.
- Build baseline: Windows installer builds successfully as `dist/MDBasics-0.1.2-Setup-x64.exe`.

### Partially Implemented / Needs Hardening
- Context menus exist for editor selection, insertion, formatting, and tables, but should be retested after CodeMirror because editor APIs will change.
- Search/replace exists in the activity pane for active-document workflows, but needs deeper keyboard polish and result presentation hardening.
- Per-file state persists zoom, layout, pane views, active pane, and inspector state by path; last active tab/window restore is not yet complete.
- Formatting toolbar applies basic Markdown edits, but it does not yet reflect active formatting state; that depends on CodeMirror syntax/state awareness.
- Line numbers are stable logical line numbers only. Wrapped-line alignment remains a known bug under aggressive wrapping, zoom, pane resize, and window resize.
- Visual richness profiles are first-pass CSS/settings surfaces. They need visual tuning, screenshot review, and fuller CodeMirror decorations for block quotes, lists, tables, horizontal rules, and fenced code blocks.

### Remaining Work Queue
1. Continue shrinking renderer compatibility fallbacks as CodeMirror command coverage grows.
2. Build the visual richness customization surface:
   - app display variants,
   - editor Markdown representation profiles,
   - preview/export presentation profiles,
   - density presets,
   - syntax-marker visibility modes,
   - persisted font/profile settings.
3. Add CodeMirror Markdown syntax styling profiles: None, Clean Markdown, Obsidian-like, VS Code-like, Minimal Writer, Technical.
4. Add folding for headings, nested list sections, fenced code blocks, and tables.
5. Make formatting toolbar buttons reflect active formatting state where CodeMirror can detect it.
6. Move slash commands toward a CodeMirror completion source.
7. Move Search/Replace toward CodeMirror search state and decorations.
8. Finish per-file/session restore: last active tab, recent workspace state, and stronger persistence around reopened files.
9. Configure a real application icon so packaged builds no longer use the default Electron icon.

### Known Bugs / Deferred Decisions
- The textarea line-number bug is resolved for Code panes by CodeMirror gutters. Continue testing aggressive wrapping, zoom, pane resize, and window resize.
- Scroll sync and scroll anchoring are parked. Controls remain visible but disabled.
- App-icon menu feature set, shortcut labels, submenu sequencing, and type-to-filter reset behavior are parked for future workflow testing.
- Pane-menu collapse into a `...` handler is logged as future UI work, not part of this pass.
- WYSIWYG editing remains out of scope.

## Key Changes

### App Shell And Navigation
- Replace top `File / Edit / View / Settings` labels with an app-icon menu opened from the top-left logo.
- Top bar contains: app logo/menu, tab strip, subtle tab actions, inspector button near window controls.
- Make tabs blend into the app canvas: no detached tab cards, no hard underline, selected tab slightly brighter/bolder.
- Move split-view toggle to the right side of the tab strip as one subtle icon.
- Put export/share actions in the tab/action area as a prominent share button with PDF, DOCX, HTML, Print.
- Normalize icon size/color across top bar, tab actions, inspector, pane controls, and close buttons.

### Activity Bar And Docked Pane
- Add an always-visible left activity bar under the logo.
- Icons: Outline, Search, Recents, Settings at bottom.
- Hover expands the activity pane preview; clicking a tool docks the pane open.
- Docked pane stays open while switching tools and is horizontally resizable.
- Remember docked width and last active activity tool.
- Outline tool replaces inspector Index and shows document structure from headings.
- Search tool animates a search bar open inside the docked pane and focuses it.
- Search supports active-document search with toggles for case-sensitive, whole-word, and regex.
- Search results show matches with next/previous arrows.
- Replace UI sits beside search: replace current, replace all, next/previous.
- Replace scope is active document only.

### Pane Layout And Parked Scroll Sync
- Split panes remain independent, each with its own Code/Preview state.
- Pane Code/Preview controls stay inside each pane, top-right, but visually blend into the pane.
- Restore active pane indicator as a subtle accent line.
- Park scroll sync:
  - disable runtime sync behavior,
  - move existing sync code behind a dormant module boundary,
  - add disabled Settings item: `Allow scroll sync`,
  - add disabled toolbar icon, eye + down arrow, tooltip `Scroll sync parked`.
- No unified scrollbar until scroll sync is reworked later.

### Inspector
- Inspector is app-level, toggled from top-right.
- Inspector modes become:
  - Stats
  - Diff
- Remove Index from inspector; Outline owns document structure.
- Stats include characters, words, lines, paragraphs, headings, tasks total/done, tables, links, and top 5 meaningful words excluding common stop words.
- Diff defaults to changed lines only.
- Diff has a switch-style toggle: `All / Diff`.
- Diff wraps long lines and never shows horizontal row scrollbars.
- Diff is not tied to scroll sync.

### Settings And Persistence
- Add persistent settings via Electron user data.
- Persist:
  - theme variant,
  - accent color,
  - glass/transparency,
  - editor font,
  - preview/export font,
  - show formatting toolbar,
  - show line numbers,
  - line wrap,
  - docked activity pane width,
  - last activity tool,
  - recent files.
- Persist per-file state by file path:
  - zoom,
  - layout mode,
  - pane views,
  - inspector open/mode,
  - last active tab.
- Add IPC for settings load/save and recent files.

### CodeMirror 6 Editor Foundation
- Replace textarea editor with CodeMirror 6.
- Add Markdown language support, commands, search, autocomplete, folding, gutters, and theme extensions.
- Preserve existing Markdown behavior: slash menu, Ctrl+B/I/U, block shortcuts, table editing, save/open/export, undo/redo, split-pane shared text.
- Use CodeMirror as the foundation for syntax styling, folding, selection state, formatting state, and future scroll sync.
- Move precise wrapped-line gutter behavior into CodeMirror; the textarea foundation keeps stable logical line numbers only because native textarea wrapping cannot expose reliable visual row positions.
- Known bug until CodeMirror: textarea line numbers are fragile with wrapping, deep zoom, and aggressive pane/window resizing. Do not extend the current gutter algorithm further; replace it with CodeMirror-owned gutters.

### Menus And Context Menus
- Rebuild app-icon menu with grouped sections and right-aligned shortcuts.
- Type-to-filter resets on Escape while menu stays open, or after 2 seconds idle.
- Editor right-click:
  - with selection: Cut, Copy, Paste, Select All, Formatting submenu.
  - without selection: Paste, Select All, Insert submenu matching slash commands.
  - table submenu appears only inside Markdown tables.

### Formatting Toolbar
- Optional setting: `Show formatting toolbar`.
- Toolbar sits centered in the tab/action area.
- Controls: heading level, bullet, numbered, task, bold, italic, underline, strikethrough, link, table.
- Buttons reflect active formatting state where CodeMirror can detect it.
- Future pane-menu collapse: allow each pane menu to hide into a minimalist `...` handler at the pane's top-right, with the same Code/Preview, split, parked scroll-sync, and later editing options available from that menu.

### Theme And Fonts
- Replace ad hoc CSS with semantic theme tokens.
- Built-in variants:
  - Cappuccino Dark default
  - Cappuccino Light default
  - VS Code Dark+ inspired
  - GitHub Light inspired
  - Catppuccin Mocha inspired
  - Catppuccin Latte inspired
- Expand app display variants as first-class presets:
  - Native Compact: quiet, dense, Windows-native feeling.
  - Glass Workspace: subtle transparency and softer panels where OS support allows it.
  - Writer Focus: low chrome, calm document surface, fewer visible controls.
  - Technical Workspace: stronger pane boundaries, clearer gutters, stronger code/table affordances.
  - Minimal Paper: light document-first surface with muted chrome.
- Accent color applies to selections, active pane line, active icons, menu selection, and active tab.
- Editor fonts: Cascadia Code, JetBrains Mono, Fira Code, Consolas, Segoe UI, Inter.
- Preview/export fonts: Segoe UI, Aptos, Georgia, Cambria, Inter.
- Add density presets:
  - Compact,
  - Comfortable,
  - Spacious.
- App display variants must be implemented through semantic tokens and classes, not one-off component overrides.

### Editor Syntax And Folding
- Add selectable Markdown syntax visual styles:
  - None
  - Clean Markdown
  - Obsidian-like
  - VS Code-like
  - Minimal Writer
  - Technical
- Style headings, bold, italic, underline tags, inline code, links, block quotes, lists, tasks, table headers, horizontal rules, and fenced code blocks.
- Add generic fenced-code styling without language-specific parsing.
- Add editor representation controls:
  - Syntax markers: Show, Fade, Hide outside cursor context.
  - Heading treatment: Plain, Scaled, Editorial.
  - Code block treatment: Plain, Panel, Terminal-like.
  - Quote/callout treatment: Plain, Accent rail, Soft panel.
  - Table treatment: Raw Markdown, Header emphasis, Grid-assisted.
- Add folding for headings, nested list sections, fenced code blocks, and tables.

### Preview And Export Presentation
- Add selectable preview/export presentation profiles independent from the editor representation:
  - GitHub,
  - Document,
  - Report,
  - Minimal,
  - Academic,
  - Notion-like.
- Preview/export profiles control document typography, heading scale, table styling, code-block styling, blockquote/callout styling, and print/PDF spacing.
- Editor style and preview/export style must remain independent because editing readability and final document presentation are different workflows.

## Test Plan
- No-doc screen centers logo/button in main editor area.
- App icon opens unified menu; old top menu labels are gone.
- Activity bar always visible; hover expands; clicking docks; width persists.
- Outline shows heading structure and replaces inspector Index.
- Search focuses on open, supports next/previous, replace current, replace all, and matching toggles.
- Split panes keep independent scroll and independent Code/Preview modes.
- Scroll sync controls are visible but disabled.
- CodeMirror preserves existing Markdown shortcuts and table behavior.
- Settings persist after restart.
- Per-file zoom/view state restores.
- Inspector Stats and Diff work; Diff wraps and defaults to changed lines.
- Theme, accent, editor font, and preview/export font settings apply consistently.

## Assumptions
- WYSIWYG editing remains out of scope.
- Scroll sync is parked, not fixed.
- CodeMirror 6 is the editor foundation.
- Replace operations affect only the active document.
- Activity pane docking stays open once clicked and is resized manually.
- Markdown remains GitHub-flavored Markdown for broad Notion/Obsidian compatibility.
