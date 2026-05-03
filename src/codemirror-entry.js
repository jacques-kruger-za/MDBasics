import { EditorView } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import { markdown, markdownKeymap, insertNewlineContinueMarkup, deleteMarkupBackward } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import * as markdownCommands from "./modules/markdown-commands.js";
import { markdownRichView } from "./modules/markdown-rich-view.js";

const wrapCompartment = new Compartment();
const gutterCompartment = new Compartment();
const zoomCompartment = new Compartment();
const displayCompartment = new Compartment();

const mdbTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "transparent",
      color: "var(--text)"
    },
    "&.cm-focused": {
      outline: "0"
    },
    ".cm-scroller": {
      height: "100%",
      overflow: "auto",
      backgroundColor: "transparent",
      fontFamily: "var(--editor-font)",
      lineHeight: "1.75",
      scrollbarGutter: "stable",
      scrollbarColor: "color-mix(in srgb, var(--muted) 32%, transparent) transparent",
      scrollbarWidth: "auto"
    },
    ".cm-scroller::-webkit-scrollbar": {
      width: "13px",
      height: "13px"
    },
    ".cm-scroller::-webkit-scrollbar-button": {
      display: "none",
      width: "0",
      height: "0"
    },
    ".cm-scroller::-webkit-scrollbar-track": {
      background: "transparent"
    },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      minHeight: "44px",
      border: "4px solid transparent",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--muted) 24%, transparent)",
      backgroundClip: "content-box"
    },
    ".cm-scroller:hover::-webkit-scrollbar-thumb": {
      background: "color-mix(in srgb, var(--muted) 42%, transparent)",
      backgroundClip: "content-box"
    },
    ".cm-content": {
      minHeight: "100%",
      padding: "8px 36px 44px 13px",
      caretColor: "var(--accent)"
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "0",
      color: "color-mix(in srgb, var(--muted) 48%, transparent)"
    },
    ".cm-lineNumbers": {
      minWidth: "43px"
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "34px",
      padding: "0 9px 0 0",
      fontSize: "11px"
    },
    ".cm-foldGutter .cm-gutterElement": {
      fontSize: "11px"
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)"
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--selection-bg)"
    }
  },
  { dark: true }
);

function lineWrappingExtension(enabled) {
  return enabled ? EditorView.lineWrapping : [];
}

function lineNumberExtension(enabled) {
  const stableLineNumberGutter = lineNumbers({
    formatNumber: (lineNo) => (enabled ? String(lineNo) : "")
  });
  return enabled ? [stableLineNumberGutter, foldGutter()] : [stableLineNumberGutter];
}

function zoomExtension(fontSize) {
  return EditorView.theme({
    ".cm-content": {
      fontSize: `${fontSize || 15}px`
    }
  });
}

function editorDisplayExtension(options = {}) {
  const editorStyle = ["none", "clean", "obsidian", "vscode", "minimal-writer", "technical"].includes(options.editorStyle)
    ? options.editorStyle
    : "clean";
  const syntaxMarkers = ["show", "fade", "hide"].includes(options.syntaxMarkers) ? options.syntaxMarkers : "fade";
  if (editorStyle === "none") {
    return [
      EditorView.theme({
        ".cm-md-heading, .cm-md-bold, .cm-md-italic, .cm-md-strikethrough, .cm-md-inline-code, .cm-md-code-content, .cm-md-quote-content": {
          font: "inherit",
          color: "inherit",
          backgroundColor: "transparent",
          border: "0",
          padding: "0",
          textDecoration: "inherit"
        },
        ".cm-md-syntax-muted, .cm-md-syntax-hidden, .cm-md-syntax-visible": {
          opacity: "1",
          color: "inherit"
        }
      })
    ];
  }

  return [markdownRichView({ syntaxMarkers }), EditorView.theme(editorDisplayRules(editorStyle, syntaxMarkers))];
}

function editorDisplayRules(editorStyle, syntaxMarkers) {
  const hiddenOpacity = syntaxMarkers === "hide" || editorStyle === "minimal-writer" ? "0.035" : "0.16";
  const visibleMarker = syntaxMarkers === "show" || editorStyle === "vscode" || editorStyle === "technical";
  const rules = {
    ".cm-md-syntax-visible, .cm-md-syntax-visible *": {
      color: "var(--muted)",
      opacity: "1"
    },
    ".cm-md-syntax-muted, .cm-md-syntax-muted *": {
      color: "color-mix(in srgb, var(--muted) 70%, transparent)",
      opacity: visibleMarker ? "1" : "0.72"
    },
    ".cm-md-syntax-hidden, .cm-md-syntax-hidden *": {
      color: "color-mix(in srgb, var(--muted) 54%, transparent)",
      opacity: visibleMarker ? "1" : hiddenOpacity
    },
    ".cm-md-indent": {
      opacity: "0.55"
    },
    ".cm-md-bold, .cm-md-bold *": {
      fontWeight: "760",
      color: "color-mix(in srgb, var(--text-normal) 90%, var(--interactive-accent))"
    },
    ".cm-md-italic, .cm-md-italic *": {
      fontStyle: "italic",
      color: "color-mix(in srgb, var(--text-normal) 92%, var(--interactive-accent))"
    },
    ".cm-md-strikethrough, .cm-md-strikethrough *": {
      textDecoration: "line-through",
      color: "color-mix(in srgb, var(--text-normal) 76%, var(--text-muted))"
    },
    ".cm-md-inline-code, .cm-md-inline-code *": {
      padding: "0 3px",
      borderRadius: "4px",
      backgroundColor: "var(--code-background)",
      color: "color-mix(in srgb, var(--interactive-accent) 72%, var(--text-normal))",
      fontFamily: "var(--editor-font)"
    },
    ".cm-md-heading-line": {
      color: "var(--text-normal)"
    },
    ".cm-md-heading-marker, .cm-md-heading-marker *": {
      color: "color-mix(in srgb, var(--text-muted) 50%, transparent)"
    },
    ".cm-md-heading, .cm-md-heading *": {
      fontWeight: "780",
      color: "var(--text-normal)"
    },
    ".cm-md-heading-1, .cm-md-heading-1 *": {
      fontSize: "1.55em"
    },
    ".cm-md-heading-2, .cm-md-heading-2 *": {
      fontSize: "1.32em"
    },
    ".cm-md-heading-3, .cm-md-heading-3 *": {
      fontSize: "1.16em"
    },
    ".cm-md-quote-line": {
      backgroundColor: "color-mix(in srgb, var(--interactive-accent) 4%, transparent)"
    },
    ".cm-md-quote-marker, .cm-md-quote-marker *": {
      color: "var(--interactive-accent)",
      fontWeight: "700"
    },
    ".cm-md-quote-content, .cm-md-quote-content *": {
      color: "color-mix(in srgb, var(--text-normal) 78%, var(--text-muted))"
    },
    ".cm-md-list-marker, .cm-md-list-marker *": {
      color: "var(--interactive-accent)",
      fontWeight: "720"
    },
    ".cm-md-code-line": {
      backgroundColor: "color-mix(in srgb, var(--code-background) 70%, transparent)"
    },
    ".cm-md-code-fence, .cm-md-code-fence *, .cm-md-code-info, .cm-md-code-info *": {
      color: "color-mix(in srgb, var(--interactive-accent) 64%, var(--text-muted))"
    },
    ".cm-md-code-content, .cm-md-code-content *": {
      color: "color-mix(in srgb, var(--text-normal) 82%, var(--text-muted))"
    },
    ".cm-md-table-line": {
      backgroundColor: "color-mix(in srgb, var(--table-header-background) 40%, transparent)"
    },
    ".cm-md-table-delimiter, .cm-md-table-delimiter *": {
      color: "color-mix(in srgb, var(--interactive-accent) 66%, var(--text-muted))"
    },
    ".cm-md-table-rule, .cm-md-table-rule *": {
      color: "color-mix(in srgb, var(--text-muted) 70%, transparent)"
    },
    ".cm-md-thematic-break, .cm-md-thematic-break *": {
      color: "color-mix(in srgb, var(--interactive-accent) 58%, var(--text-muted))"
    }
  };

  if (editorStyle === "obsidian") {
    rules[".cm-md-heading, .cm-md-heading *"] = {
      fontWeight: "760",
      color: "color-mix(in srgb, var(--interactive-accent) 28%, var(--text-normal))"
    };
    rules[".cm-md-inline-code, .cm-md-inline-code *"].backgroundColor = "color-mix(in srgb, var(--interactive-accent) 14%, transparent)";
    rules[".cm-md-inline-code, .cm-md-inline-code *"].border = "1px solid color-mix(in srgb, var(--interactive-accent) 18%, transparent)";
  }

  if (editorStyle === "vscode") {
    rules[".cm-md-bold, .cm-md-bold *"].color = "#dcdcaa";
    rules[".cm-md-italic, .cm-md-italic *"].color = "#ce9178";
    rules[".cm-md-inline-code, .cm-md-inline-code *"].color = "#4ec9b0";
    rules[".cm-md-heading, .cm-md-heading *"].color = "color-mix(in srgb, #569cd6 72%, var(--text-normal))";
    rules[".cm-md-code-content, .cm-md-code-content *"].color = "#d4d4d4";
  }

  if (editorStyle === "minimal-writer") {
    rules[".cm-md-heading, .cm-md-heading *"] = {
      fontFamily: "var(--preview-font)",
      fontWeight: "680",
      color: "var(--text-normal)"
    };
    rules[".cm-md-quote-line"].backgroundColor = "transparent";
    rules[".cm-md-table-line"].backgroundColor = "transparent";
    rules[".cm-md-code-line"].backgroundColor = "transparent";
  }

  if (editorStyle === "technical") {
    rules[".cm-gutters"] = {
      backgroundColor: "color-mix(in srgb, var(--surface-raised) 22%, transparent)",
      borderRight: "1px solid var(--subtle-hairline)"
    };
    rules[".cm-md-inline-code, .cm-md-inline-code *"].border = "1px solid color-mix(in srgb, var(--interactive-accent) 22%, var(--line))";
    rules[".cm-md-inline-code, .cm-md-inline-code *"].backgroundColor = "color-mix(in srgb, var(--app-bg) 66%, var(--interactive-accent) 6%)";
    rules[".cm-md-table-line"].backgroundColor = "color-mix(in srgb, var(--interactive-accent) 6%, transparent)";
  }

  return rules;
}

function createMarkdownEditor(options) {
  const parent = options.parent;
  let applyingExternalUpdate = false;

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: options.value || "",
      extensions: [
        highlightSpecialChars(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        markdown({ codeLanguages: languages, addKeymap: false }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        indentOnInput(),
        bracketMatching(),
        closeBrackets({ brackets: ["(", "[", "{", "'", "\""] }),
        EditorView.domEventHandlers({
          keydown: (event) => options.onKeydown?.(event) === true
        }),
        keymap.of([
          indentWithTab,
          ...markdownKeymap,
          ...defaultKeymap,
          ...foldKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap
        ]),
        mdbTheme,
        wrapCompartment.of(lineWrappingExtension(options.lineWrapping !== false)),
        gutterCompartment.of(lineNumberExtension(Boolean(options.lineNumbers))),
        zoomCompartment.of(zoomExtension(options.fontSize)),
        displayCompartment.of(editorDisplayExtension({
          editorStyle: options.editorStyle,
          syntaxMarkers: options.syntaxMarkers
        })),
        EditorView.updateListener.of((update) => {
          if (applyingExternalUpdate) return;
          if (update.docChanged) options.onChange?.(getApi().getValue());
          if (update.selectionSet || update.docChanged) options.onCursor?.();
        })
      ]
    })
  });

  view.dom.classList.add("mdb-codemirror");
  view.dom.addEventListener("focusin", () => options.onFocus?.());
  view.dom.addEventListener("contextmenu", (event) => options.onContextMenu?.(event));
  view.dom.addEventListener("keyup", (event) => options.onKeyup?.(event));
  view.scrollDOM.addEventListener("scroll", () => options.onScroll?.());
  view.scrollDOM.addEventListener("wheel", (event) => options.onWheel?.(event), { passive: false });

  function getApi() {
    const api = {
      view,
      dom: view.dom,
      scrollDOM: view.scrollDOM,
      getValue() {
        return view.state.doc.toString();
      },
      setValue(value) {
        const next = value || "";
        if (next === view.state.doc.toString()) return;
        applyingExternalUpdate = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next }
        });
        applyingExternalUpdate = false;
      },
      focus() {
        view.focus();
      },
      hasFocus() {
        return view.hasFocus;
      },
      destroy() {
        view.destroy();
      },
      getSelection() {
        const range = view.state.selection.main;
        return { start: range.from, end: range.to };
      },
      setSelection(start, end = start) {
        const docLength = view.state.doc.length;
        const anchor = Math.max(0, Math.min(start, docLength));
        const head = Math.max(0, Math.min(end, docLength));
        view.dispatch({ selection: { anchor, head }, scrollIntoView: true });
      },
      selectAll() {
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      },
      replaceRange(start, end, text, cursor) {
        return markdownCommands.replaceRange(view, start, end, text, cursor);
      },
      insertText(text) {
        return markdownCommands.insertText(view, text);
      },
      wrapInline(before, after) {
        return markdownCommands.wrapInline(view, before, after);
      },
      exitInlineFormatting(key) {
        return markdownCommands.exitInlineFormatting(view, key);
      },
      applyLineCommand(command, options) {
        return markdownCommands.applyLineCommand(view, command, options);
      },
      lineAt(position) {
        return view.state.doc.lineAt(Math.max(0, Math.min(position, view.state.doc.length)));
      },
      line(number) {
        return view.state.doc.line(Math.max(1, Math.min(number, view.state.doc.lines)));
      },
      lineCount() {
        return view.state.doc.lines;
      },
      coordsAtPos(position) {
        return view.coordsAtPos(Math.max(0, Math.min(position, view.state.doc.length)));
      },
      topVisibleLine() {
        const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
        return view.state.doc.lineAt(block.from).number;
      },
      continueMarkdownMarkup() {
        return insertNewlineContinueMarkup(view);
      },
      deleteMarkdownMarkupBackward() {
        return deleteMarkupBackward(view);
      },
      get scrollTop() {
        return view.scrollDOM.scrollTop;
      },
      set scrollTop(value) {
        view.scrollDOM.scrollTop = value || 0;
      },
      get scrollLeft() {
        return view.scrollDOM.scrollLeft;
      },
      set scrollLeft(value) {
        view.scrollDOM.scrollLeft = value || 0;
      },
      setLineWrapping(enabled) {
        view.dispatch({ effects: wrapCompartment.reconfigure(lineWrappingExtension(enabled)) });
      },
      setLineNumbers(enabled) {
        view.dispatch({ effects: gutterCompartment.reconfigure(lineNumberExtension(enabled)) });
      },
      setFontSize(fontSize) {
        view.dispatch({ effects: zoomCompartment.reconfigure(zoomExtension(fontSize)) });
      },
      setEditorDisplay(options = {}) {
        view.dispatch({ effects: displayCompartment.reconfigure(editorDisplayExtension(options)) });
      }
    };

    Object.defineProperties(api, {
      value: {
        get: () => api.getValue(),
        set: (value) => api.setValue(value)
      },
      selectionStart: {
        get: () => api.getSelection().start,
        set: (value) => api.setSelection(value, value)
      },
      selectionEnd: {
        get: () => api.getSelection().end,
        set: (value) => api.setSelection(api.selectionStart, value)
      },
      classList: {
        get: () => view.dom.classList
      },
      style: {
        get: () => view.dom.style
      }
    });

    api.select = api.selectAll;
    api.getBoundingClientRect = () => view.dom.getBoundingClientRect();
    api.contains = (target) => view.dom.contains(target);
    return api;
  }

  return getApi();
}

window.MDBasicsCodeMirror = { createMarkdownEditor };
