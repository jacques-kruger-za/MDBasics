import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";

const headingLine = Decoration.line({ class: "cm-md-heading-line" });

function classMark(className) {
  return Decoration.mark({ class: className });
}

function hiddenSyntax(cursorInside) {
  return classMark(cursorInside ? "cm-md-syntax-muted" : "cm-md-syntax-hidden");
}

export function markdownRichView() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildDecorations(view);
      }

      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

function buildDecorations(view) {
  const builder = new RangeSetBuilder();
  const cursor = view.state.selection.main.head;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      decorateLine(builder, line, cursor);
      if (line.to + 1 > to) break;
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

function decorateLine(builder, line, cursor) {
  const text = line.text;
  const heading = text.match(/^(#{1,6})(\s+)(.*)$/);
  if (heading) {
    builder.add(line.from, line.from, headingLine);
    builder.add(line.from, line.from + heading[1].length, classMark("cm-md-heading-marker"));
    const level = Math.min(6, heading[1].length);
    builder.add(line.from + heading[1].length + heading[2].length, line.to, classMark(`cm-md-heading cm-md-heading-${level}`));
  }

  addInlineMatches(builder, line, cursor, /\*\*([^*\n]+)\*\*/g, "cm-md-bold", 2, 2);
  addInlineMatches(builder, line, cursor, /(?<!\*)_([^_\n]+)_/g, "cm-md-italic", 1, 1);
  addInlineMatches(builder, line, cursor, /(?<!\*)\*([^*\n]+)\*/g, "cm-md-italic", 1, 1);
  addInlineMatches(builder, line, cursor, /`([^`\n]+)`/g, "cm-md-inline-code", 1, 1);
}

function addInlineMatches(builder, line, cursor, regex, contentClass, openLength, closeLength) {
  for (const match of line.text.matchAll(regex)) {
    const start = line.from + match.index;
    const end = start + match[0].length;
    const contentStart = start + openLength;
    const contentEnd = end - closeLength;
    const cursorInside = cursor >= start && cursor <= end;

    builder.add(start, contentStart, hiddenSyntax(cursorInside));
    builder.add(contentStart, contentEnd, classMark(contentClass));
    builder.add(contentEnd, end, hiddenSyntax(cursorInside));
  }
}
