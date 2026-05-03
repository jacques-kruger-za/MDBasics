import { Decoration, ViewPlugin } from "@codemirror/view";

const headingLine = Decoration.line({ class: "cm-md-heading-line" });
const quoteLine = Decoration.line({ class: "cm-md-quote-line" });
const codeLine = Decoration.line({ class: "cm-md-code-line" });
const tableLine = Decoration.line({ class: "cm-md-table-line" });
const thematicBreakLine = Decoration.line({ class: "cm-md-thematic-break-line" });

function classMark(className) {
  return Decoration.mark({ class: className });
}

function syntaxMark(cursorInside, syntaxMarkers) {
  if (syntaxMarkers === "show") return classMark("cm-md-syntax-visible");
  return classMark(cursorInside ? "cm-md-syntax-muted" : "cm-md-syntax-hidden");
}

export function markdownRichView(options = {}) {
  const syntaxMarkers = ["show", "fade", "hide"].includes(options.syntaxMarkers) ? options.syntaxMarkers : "fade";
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildDecorations(view, syntaxMarkers);
      }

      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view, syntaxMarkers);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

function buildDecorations(view, syntaxMarkers) {
  const decorations = [];
  const cursor = view.state.selection.main.head;
  let inFence = isInsideFenceBefore(view.state.doc, view.visibleRanges[0]?.from || 0);

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      inFence = decorateLine(decorations, line, cursor, inFence, syntaxMarkers);
      if (line.to + 1 > to) break;
      pos = line.to + 1;
    }
  }

  return Decoration.set(decorations, true);
}

function decorateLine(decorations, line, cursor, inFence, syntaxMarkers) {
  const text = line.text;
  const fence = text.match(/^(\s*)(`{3,}|~{3,})(.*)$/);

  if (fence) {
    addDecoration(decorations, line.from, line.from, codeLine);
    addLeadingWhitespace(decorations, line, fence[1].length);
    addDecoration(decorations, line.from + fence[1].length, line.from + fence[1].length + fence[2].length, classMark("cm-md-code-fence"));
    if (fence[3]) addDecoration(decorations, line.from + fence[1].length + fence[2].length, line.to, classMark("cm-md-code-info"));
    return !inFence;
  }

  if (inFence) {
    addDecoration(decorations, line.from, line.from, codeLine);
    if (line.length) addDecoration(decorations, line.from, line.to, classMark("cm-md-code-content"));
    return inFence;
  }

  const heading = text.match(/^(#{1,6})(\s+)(.*)$/);
  if (heading) {
    addDecoration(decorations, line.from, line.from, headingLine);
    addDecoration(decorations, line.from, line.from + heading[1].length, classMark("cm-md-heading-marker"));
    const level = Math.min(6, heading[1].length);
    addDecoration(decorations, line.from + heading[1].length + heading[2].length, line.to, classMark(`cm-md-heading cm-md-heading-${level}`));
  }

  const quote = text.match(/^(\s*>+\s?)(.*)$/);
  if (quote) {
    addDecoration(decorations, line.from, line.from, quoteLine);
    addDecoration(decorations, line.from, line.from + quote[1].length, classMark("cm-md-quote-marker"));
    if (quote[2]) addDecoration(decorations, line.from + quote[1].length, line.to, classMark("cm-md-quote-content"));
  }

  const list = text.match(/^(\s*)([-+*]|\d+[.)])(\s+)(.*)$/);
  if (list) {
    addLeadingWhitespace(decorations, line, list[1].length);
    const markerStart = line.from + list[1].length;
    addDecoration(decorations, markerStart, markerStart + list[2].length, classMark("cm-md-list-marker"));
  }

  if (isTableLike(text)) {
    addDecoration(decorations, line.from, line.from, tableLine);
    addTableMarks(decorations, line);
  }

  if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
    addDecoration(decorations, line.from, line.from, thematicBreakLine);
    addDecoration(decorations, line.from, line.to, classMark("cm-md-thematic-break"));
  }

  addInlineMatches(decorations, line, cursor, /\*\*([^*\n]+)\*\*/g, "cm-md-bold", 2, 2, syntaxMarkers);
  addInlineMatches(decorations, line, cursor, /__([^_\n]+)__/g, "cm-md-bold", 2, 2, syntaxMarkers);
  addInlineMatches(decorations, line, cursor, /(?<!\*)_([^_\n]+)_/g, "cm-md-italic", 1, 1, syntaxMarkers);
  addInlineMatches(decorations, line, cursor, /(?<!\*)\*([^*\n]+)\*/g, "cm-md-italic", 1, 1, syntaxMarkers);
  addInlineMatches(decorations, line, cursor, /~~([^~\n]+)~~/g, "cm-md-strikethrough", 2, 2, syntaxMarkers);
  addInlineMatches(decorations, line, cursor, /`([^`\n]+)`/g, "cm-md-inline-code", 1, 1, syntaxMarkers);
  return inFence;
}

function addInlineMatches(decorations, line, cursor, regex, contentClass, openLength, closeLength, syntaxMarkers) {
  for (const match of line.text.matchAll(regex)) {
    const start = line.from + match.index;
    const end = start + match[0].length;
    const contentStart = start + openLength;
    const contentEnd = end - closeLength;
    const cursorInside = cursor >= start && cursor <= end;

    addDecoration(decorations, start, contentStart, syntaxMark(cursorInside, syntaxMarkers));
    addDecoration(decorations, contentStart, contentEnd, classMark(contentClass));
    addDecoration(decorations, contentEnd, end, syntaxMark(cursorInside, syntaxMarkers));
  }
}

function addLeadingWhitespace(decorations, line, length) {
  if (length > 0) addDecoration(decorations, line.from, line.from + length, classMark("cm-md-indent"));
}

function isTableLike(text) {
  const trimmed = text.trim();
  return trimmed.includes("|") && trimmed.length > 1;
}

function addTableMarks(decorations, line) {
  for (let offset = 0; offset < line.text.length; offset += 1) {
    if (line.text[offset] === "|") {
      addDecoration(decorations, line.from + offset, line.from + offset + 1, classMark("cm-md-table-delimiter"));
    }
  }
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.text)) {
    addDecoration(decorations, line.from, line.to, classMark("cm-md-table-rule"));
  }
}

function addDecoration(decorations, from, to, decoration) {
  if (to < from) return;
  decorations.push(decoration.range(from, to));
}

function isInsideFenceBefore(doc, position) {
  let inFence = false;
  let pos = 0;
  while (pos < position) {
    const line = doc.lineAt(pos);
    if (/^\s*(`{3,}|~{3,})/.test(line.text)) inFence = !inFence;
    if (line.to + 1 >= position) break;
    pos = line.to + 1;
  }
  return inFence;
}
