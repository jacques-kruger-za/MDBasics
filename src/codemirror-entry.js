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
        markdownRichView(),
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
