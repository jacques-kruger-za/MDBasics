# CodeMirror Editing Map

Last updated: 2026-05-02

## Current Integration Shape

MDBasics now mounts CodeMirror 6 for Code panes through `src/codemirror-entry.js`, bundled to `src/vendor/codemirror.bundle.js`.

The renderer keeps the existing document, pane, preview, menu, and export architecture. CodeMirror is isolated behind a small adapter exposed as `window.MDBasicsCodeMirror.createMarkdownEditor`.

The authoritative Markdown baseline is the official `@codemirror/lang-markdown` package. MDBasics enables the language parser, fenced-code language support, and official Markdown keymap/commands explicitly. Custom MDBasics behavior should sit on top of that baseline only when the app intentionally wants a different workflow.

MDBasics editor-specific behavior now lives in two local modules:

- `src/modules/markdown-commands.js`: CodeMirror transaction commands for inline wrappers, insertions, line commands, and range replacement.
- `src/modules/markdown-rich-view.js`: CodeMirror decorations for the hybrid Markdown reading layer.

## Editing Behavior Map

| Behavior | Previous textarea approach | CodeMirror approach now | Notes |
| --- | --- | --- | --- |
| Open document | Set `textarea.value` from document text | CodeMirror document is initialized from document text | Existing open/recent flow remains unchanged. |
| Edit document | `input` event read `textarea.value` | CodeMirror update listener calls renderer `handlePaneInput` | Dirty state, preview refresh, stats, and diff still flow through existing document state. |
| Split panes | Two textareas shared the same document text | Two CodeMirror views share the same document text through renderer state | Independent pane view, cursor, and scroll state remain. |
| Preview | Renderer converted current Markdown to sanitized HTML | Same renderer preview path | Preview still updates after CodeMirror doc changes. |
| Line numbers | Custom textarea gutter with fragile wrapping behavior | CodeMirror line-number gutter | Hidden line numbers leave a stable spacer so text does not shift. |
| Line wrap | CSS `white-space` on textarea | CodeMirror `EditorView.lineWrapping` compartment | Setting reconfigures CodeMirror without recreating the pane. |
| Zoom | CSS font-size variable | CodeMirror theme compartment | Existing zoom setting still drives editor font size. |
| Bold | Manual selection wrapper `**...**` | `markdown-commands.wrapInline` applies a CodeMirror transaction | `markdown-rich-view` displays bold content visually bold and fades syntax markers outside cursor context. |
| Italic | Manual selection wrapper `_..._` | `markdown-commands.wrapInline` applies a CodeMirror transaction | `markdown-rich-view` displays italic content visually italic and fades syntax markers outside cursor context. |
| Underline | Manual selection wrapper `<u>...</u>` | `markdown-commands.wrapInline` applies a CodeMirror transaction and `exitInlineFormatting` exits the closing `</u>` marker | Markdown extension remains HTML underline; rich decoration for underline still needs to be added. |
| Strikethrough | Manual selection wrapper `~~...~~` | `markdown-commands.wrapInline` applies a CodeMirror transaction and `exitInlineFormatting` exits the closing `~~` marker | Future: add rich decoration and toolbar active state. |
| Inline code | Manual selection wrapper `` `...` `` | `markdown-commands.wrapInline` applies a CodeMirror transaction | `markdown-rich-view` gives inline code a compact code-pill visual treatment. |
| Paired punctuation | Native textarea typing | `exitInlineFormatting` exits empty or completed wrappers for `` ` ``, `" "`, `' '`, `[ ]`, `( )`, `{ }`, and `< >` | Single Space stays inside; Tab exits; Enter exits inline formatting but continues the current block type; repeated closing character, repeated formatting command, right-click, or double Space exits. |
| Headings | Current-line marker replacement | `markdown-commands.applyLineCommand` applies a CodeMirror transaction | `markdown-rich-view` styles heading text and mutes heading markers; heading insertion and Enter from the end of a heading leave one blank separator before normal text. |
| Lists/tasks | Current-line marker replacement and Enter continuation | MDBasics handles intentional app-specific Enter/Tab behavior before falling back to official `insertNewlineContinueMarkup` and `deleteMarkupBackward` | Tab indents list items, Shift+Tab outdents, ordered-list blocks renumber after indentation changes, and empty-marker exit leaves one blank separator before normal text. |
| Quote blocks | Current-line marker replacement | MDBasics handles quote continuation before CodeMirror fallback to preserve the app's block-exit timing | Enter continues the quote; Enter again on an empty quote exits and leaves one blank separator before normal text. |
| Code blocks | Slash command inserted fenced block text | MDBasics handles raw fence starts and fence exit ahead of CodeMirror Markdown keymaps | Typing ``` then Enter creates a closing fence; Enter continues inside the fence; Enter again on a blank line before the closing fence exits after the fence with one blank separator. |
| Tables | `table-editing.js` receives text and cursor offset | Same module receives CodeMirror document text and cursor offset | Enter inserts a new row from a populated row; Enter on an empty data row exits the table with one blank separator; Ctrl+Arrow navigates cells. |
| Dividers | Slash command inserted raw `---` text | `markdown-commands.applyLineCommand` applies a CodeMirror transaction with block spacing | Divider insertion and Enter from the divider line leave one blank separator before normal text. |
| Slash commands | Textarea caret positioning and line replacement | Same slash menu, with caret position from CodeMirror `coordsAtPos`; selected command delegates to `markdown-commands.applyLineCommand` | Future: CodeMirror completion source could replace custom slash menu. |
| Right-click menu | Textarea selection and cursor inspection | Same context menu using CodeMirror selection adapter | Retest after deeper editor-module split. |
| Formatting toolbar | Buttons called renderer edit helpers | Same buttons call helpers backed by CodeMirror adapter | Future: toolbar active state should read CodeMirror syntax/selection state. |
| Search/replace activity pane | String matching against document text and textarea selection | Same document text search; selection jumps into CodeMirror | Future: replace with CodeMirror search package for editor-native search UX. |
| Folding | Not available | CodeMirror fold gutter package is loaded when line numbers are visible | Future: add explicit Markdown folding commands and UI affordances. |

## Native CodeMirror Work Still To Do

- Prefer official `@codemirror/lang-markdown` commands/keymaps wherever they cover the desired Markdown behavior.
- Continue shrinking renderer compatibility fallbacks as CodeMirror command coverage grows.
- Move slash commands toward a CodeMirror completion source.
- Move search/replace toward CodeMirror search state and decorations.
- Add Markdown syntax styling profiles as CodeMirror themes/extensions.
- Add active formatting detection from CodeMirror syntax/selection state.
- Split renderer responsibilities around the editor adapter during the next structural pass.
