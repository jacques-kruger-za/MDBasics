export function replaceRange(view, start, end, text, cursor = start + String(text).length) {
  view.dispatch({
    changes: { from: start, to: end, insert: text },
    selection: { anchor: cursor },
    scrollIntoView: true,
    userEvent: "input"
  });
  view.focus();
  return true;
}

export function insertText(view, text) {
  const range = view.state.selection.main;
  return replaceRange(view, range.from, range.to, text);
}

export function wrapInline(view, before, after) {
  if (exitInlineFormatting(view, before)) return true;
  const range = view.state.selection.main;
  const selected = view.state.sliceDoc(range.from, range.to);
  const replacement = `${before}${selected}${after}`;
  const anchor = range.from + before.length;
  const head = anchor + selected.length;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    selection: { anchor, head },
    scrollIntoView: true,
    userEvent: "input"
  });
  view.focus();
  return true;
}

export function exitInlineFormatting(view, key) {
  const range = view.state.selection.main;
  if (range.from !== range.to) return false;
  const cursor = range.from;
  const doc = view.state.doc;
  const formats = [
    { before: "**", after: "**", keys: ["**"] },
    { before: "_", after: "_", keys: ["_"] },
    { before: "<u>", after: "</u>", keys: ["<u>"] },
    { before: "~~", after: "~~", keys: ["~~"] },
    { before: "`", after: "`", keys: ["`"] },
    { before: "\"", after: "\"", keys: ["\""] },
    { before: "'", after: "'", keys: ["'"] },
    { before: "[", after: "]", keys: ["]"] },
    { before: "(", after: ")", keys: [")"] },
    { before: "{", after: "}", keys: ["}"] },
    { before: "<", after: ">", keys: [">"] }
  ];
  const format = formats.find((item) => doc.sliceString(cursor, cursor + item.after.length) === item.after);
  if (!format) return false;
  const isNavigationExit = key === "Enter" || key === "Tab";
  const isRepeatedCommand = format.keys.includes(key) || format.after === key;
  const isDoubleSpaceExit = key === " " && cursor > 0 && doc.sliceString(cursor - 1, cursor) === " ";
  if (!isNavigationExit && !isRepeatedCommand && !isDoubleSpaceExit) return false;

  const separator = key === "Enter" ? `\n${getContinuationPrefix(doc, cursor)}` : isDoubleSpaceExit ? " " : "";
  const beforeStart = cursor - format.before.length;
  const isEmptyWrapper = beforeStart >= 0 && doc.sliceString(beforeStart, cursor) === format.before;
  const contentEnd = isDoubleSpaceExit ? cursor - 1 : cursor;

  if (isEmptyWrapper) {
    view.dispatch({
      changes: { from: beforeStart, to: cursor + format.after.length, insert: separator },
      selection: { anchor: beforeStart + separator.length },
      scrollIntoView: true,
      userEvent: "input"
    });
  } else {
    view.dispatch({
      changes: { from: contentEnd, to: cursor + format.after.length, insert: `${format.after}${separator}` },
      selection: { anchor: contentEnd + format.after.length + separator.length },
      scrollIntoView: true,
      userEvent: "input"
    });
  }
  view.focus();
  return true;
}

export function applyLineCommand(view, command, options = {}) {
  if (!command) return false;
  const range = view.state.selection.main;
  const doc = view.state.doc;
  const line = doc.lineAt(range.from);
  const currentLine = line.text;
  const lineText = options.stripSlash ? currentLine.replace(/^\/\w*\s*/, "") : currentLine;
  const text = stripBlockMarker(lineText);

  if (command.marker === "paragraph") {
    return replaceRange(view, line.from, line.to, text, line.from + text.length);
  }

  if (command.marker === "table") {
    const table = options.table;
    if (!table?.text) return false;
    const prefix = line.from > 0 && doc.sliceString(line.from - 1, line.from) !== "\n" ? "\n" : "";
    const suffix = line.to < doc.length && doc.sliceString(line.to, line.to + 1) !== "\n" ? "\n" : "";
    const replacement = `${prefix}${table.text}${suffix}`;
    return replaceRange(view, line.from, line.to, replacement, line.from + prefix.length + (table.cursorOffset || 0));
  }

  if (/^#{1,6}\s$/.test(command.marker)) {
    const heading = `${command.marker}${text}`;
    const replacement = ensureBlockSeparatorAfter(doc, line, heading);
    return replaceRange(view, line.from, line.to, replacement.text, line.from + Math.min(heading.length, replacement.text.length));
  }

  if (command.marker === "---\n\n") {
    const replacement = ensureBlockSeparatorAround(doc, line, "---");
    return replaceRange(view, line.from, line.to, replacement.text, line.from + replacement.cursorOffset);
  }

  const marker = command.marker === "numbered" ? `${getNextListNumberBefore(doc, line.from)}. ` : command.marker;
  const replacement = marker.includes("\n") ? marker : `${marker}${text}`;
  return replaceRange(view, line.from, line.to, replacement, line.from + (command.cursorOffset ?? replacement.length));
}

export function stripBlockMarker(line) {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s{0,3}>\s?/, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "");
}

function getNextListNumberBefore(doc, position) {
  const before = doc.sliceString(0, position).split(/\r?\n/).reverse();
  for (const line of before) {
    const match = line.match(/^\s*(\d+)\.\s/);
    if (match) return Number(match[1]) + 1;
    if (line.trim() !== "") break;
  }
  return 1;
}

function getContinuationPrefix(doc, position) {
  const line = doc.lineAt(position);
  const task = line.text.match(/^(\s*)-\s\[[ xX]\]\s/);
  if (task) return `${task[1]}- [ ] `;

  const numbered = line.text.match(/^(\s*)(\d+)\.\s/);
  if (numbered) return `${numbered[1]}${Number(numbered[2]) + 1}. `;

  const bullet = line.text.match(/^(\s*)([-*+])\s/);
  if (bullet) return `${bullet[1]}${bullet[2]} `;

  const quote = line.text.match(/^(\s*>\s?)/);
  if (quote) return quote[1];

  return "";
}

function ensureBlockSeparatorAfter(doc, line, text) {
  const hasNextBlank = doc.sliceString(line.to, Math.min(doc.length, line.to + 2)) === "\n\n";
  return {
    text: hasNextBlank ? text : `${text}\n\n`
  };
}

function ensureBlockSeparatorAround(doc, line, text) {
  const needsBefore = line.from > 0 && doc.sliceString(line.from - 1, line.from) !== "\n";
  const needsAfter = line.to < doc.length && doc.sliceString(line.to, Math.min(doc.length, line.to + 2)) !== "\n\n";
  const prefix = needsBefore ? "\n" : "";
  const suffix = needsAfter ? "\n\n" : line.to >= doc.length ? "\n\n" : "";
  return {
    text: `${prefix}${text}${suffix}`,
    cursorOffset: prefix.length + text.length + suffix.length
  };
}
