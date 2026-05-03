---
project: MDBasics
status: active
last_updated: 2026-05-03
---

# MDBasics — Project Overview

Living state + history. Captures what this project is made of, what it does, why it's shaped the way it is, and what's been done. Mirrored to vault as `_VaultOperations/projects/MDBasics_Session_Notes.md` (sparse-cloned).

For *future* work, see `ROADMAP.md` (sequenced) and `BACKLOG.md` (raw inbox).

## Stack

- **Language:** JavaScript (Node.js)
- **Framework:** Electron, CodeMirror 6
- **Key libs:** esbuild (CodeMirror bundling), electron-builder (NSIS installer)
- **Runtime / target:** Windows desktop (`.exe` via NSIS), MIT-licensed
- **External services:** None

## Functionality

- Native Windows desktop window with custom top bar; file association for `.md`, `.markdown`, `.mdown`, `.mkd`.
- Tabbed documents with single-pane and split-pane layouts; editable Code panes, read-only Preview panes.
- Right-side Diff inspector vs. the saved / opened version of the file.
- Slash-command menu for common block types; keyboard shortcuts for block conversion and inline formatting; code-view helpers for standard Markdown pipe tables.
- Dark / light mode, optional glass background, optional line numbers; status bar with line / column / char count / path / status / zoom.
- Export to HTML, PDF, DOCX; print support.

## Architecture & Key Decisions

- **2026-05-?? (current)** — CodeMirror integrated as the editor; theme and editor display settings refined and stabilised.
- **WYSIWYG paused** — preview and Diff are read-only MVP views; editing stays in the code pane.
- **CodeMirror bundled with esbuild** — single IIFE bundle (`src/vendor/codemirror.bundle.js`) loaded by the renderer; avoids per-file imports in renderer code.

## Work Log

- **recent** — Stabilize editor display reconfiguration (`a6429ce`)
- **recent** — Refine theme and editor display settings (`748e82d`)
- **recent** — Integrate CodeMirror markdown editing (`d573806`)
- **v0.1.2** — Pane model MVP (`44810eb`)
- **v0.1.1** — File associations (`2293096`)

## References

- **Repo:** github.com/jacques-kruger-za/MDBasics
- **Prod URL / deployment:** Local NSIS installer — `dist/MDBasics-<version>-Setup-<arch>.exe`
- **Vault status:** `_VaultOperations/projects/MDBasics_Session_Notes.md`
- **Key resource IDs:** _TODO_
- **Related vault notes:** _TODO_
