(function () {
  function getLineEntries(value) {
    const lines = value.split("\n");
    let offset = 0;
    return lines.map((text) => {
      const entry = { start: offset, end: offset + text.length, text };
      offset += text.length + 1;
      return entry;
    });
  }

  function hasUnescapedPipe(line) {
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === "|" && line[index - 1] !== "\\") return true;
    }
    return false;
  }

  function isTableishLine(line) {
    return line.trim() !== "" && hasUnescapedPipe(line);
  }

  function splitRow(line) {
    const trimmed = line.trim();
    const body = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    const cells = [];
    let current = "";

    for (let index = 0; index < body.length; index += 1) {
      const char = body[index];
      if (char === "\\" && body[index + 1] === "|") {
        current += "\\|";
        index += 1;
      } else if (char === "|") {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    cells.push(current.trim());
    return cells;
  }

  function splitRowWithRanges(line) {
    const firstPipe = line.indexOf("|");
    const scanStart = firstPipe === -1 ? 0 : firstPipe + 1;
    const cells = [];
    let contentStart = scanStart;
    let current = "";

    for (let index = scanStart; index <= line.length; index += 1) {
      const char = line[index];
      const isBoundary = index === line.length || (char === "|" && line[index - 1] !== "\\");
      if (!isBoundary) {
        current += char;
        continue;
      }

      const raw = current;
      const leading = raw.match(/^\s*/)[0].length;
      const trailing = raw.match(/\s*$/)[0].length;
      cells.push({
        text: raw.trim(),
        start: contentStart + leading,
        end: contentStart + raw.length - trailing
      });
      contentStart = index + 1;
      current = "";
    }

    if (cells.length && cells[cells.length - 1].text === "" && /\|\s*$/.test(line)) {
      cells.pop();
    }
    return cells;
  }

  function isSeparatorCell(cell) {
    return /^:?-{3,}:?$/.test(cell.trim());
  }

  function getAlignment(cell) {
    const trimmed = cell.trim();
    if (/^:-{3,}:$/.test(trimmed)) return "center";
    if (/^-{3,}:$/.test(trimmed)) return "right";
    return "left";
  }

  function separatorFor(alignment, width) {
    const dashCount = Math.max(3, width);
    if (alignment === "center") return `:${"-".repeat(Math.max(3, dashCount - 2))}:`;
    if (alignment === "right") return `${"-".repeat(Math.max(3, dashCount - 1))}:`;
    return "-".repeat(dashCount);
  }

  function analyze(value, position) {
    const lines = getLineEntries(value);
    const lineIndex = lines.findIndex((line, index) => (
      position >= line.start && (position <= line.end || index === lines.length - 1)
    ));
    if (lineIndex === -1 || !isTableishLine(lines[lineIndex].text)) return null;

    let startLine = lineIndex;
    let endLine = lineIndex;
    while (startLine > 0 && isTableishLine(lines[startLine - 1].text)) startLine -= 1;
    while (endLine < lines.length - 1 && isTableishLine(lines[endLine + 1].text)) endLine += 1;

    const tableLines = lines.slice(startLine, endLine + 1);
    const parsed = tableLines.map((line) => splitRow(line.text));
    const separatorIndex = parsed.findIndex((row) => row.length > 0 && row.every(isSeparatorCell));
    if (separatorIndex === -1 || separatorIndex === 0 || parsed.length < 2) return null;

    const columnCount = Math.max(...parsed.map((row) => row.length));
    const alignments = Array.from({ length: columnCount }, (_item, index) => (
      getAlignment(parsed[separatorIndex][index] || "---")
    ));
    const rows = parsed
      .filter((_row, index) => index !== separatorIndex)
      .map((row) => padCells(row, columnCount));

    const relativeLineIndex = lineIndex - startLine;
    const dataRowIndex = relativeLineIndex > separatorIndex ? relativeLineIndex - 1 : relativeLineIndex;
    const cellRanges = splitRowWithRanges(lines[lineIndex].text);
    const relativePosition = position - lines[lineIndex].start;
    let colIndex = Math.max(0, cellRanges.findIndex((cell, index) => (
      relativePosition <= cell.end || index === cellRanges.length - 1
    )));
    if (colIndex === -1) colIndex = 0;

    return {
      start: lines[startLine].start,
      end: lines[endLine].end,
      startLine,
      endLine,
      lineIndex,
      dataRowIndex: clamp(dataRowIndex, 0, rows.length - 1),
      colIndex: clamp(colIndex, 0, columnCount - 1),
      columnCount,
      rows,
      alignments
    };
  }

  function padCells(row, count) {
    const next = row.slice(0, count);
    while (next.length < count) next.push("");
    return next;
  }

  function columnWidths(rows, alignments) {
    return alignments.map((_alignment, colIndex) => Math.max(
      3,
      ...rows.map((row) => (row[colIndex] || "").length)
    ));
  }

  function formatTable(rows, alignments) {
    const widths = columnWidths(rows, alignments);
    const header = formatRow(rows[0], widths);
    const separator = formatRow(widths.map((width, index) => separatorFor(alignments[index], width)), widths);
    const body = rows.slice(1).map((row) => formatRow(row, widths));
    return [header, separator, ...body].join("\n");
  }

  function formatRow(row, widths) {
    return `| ${row.map((cell, index) => (cell || "").padEnd(widths[index], " ")).join(" | ")} |`;
  }

  function replaceTable(value, table, rows, alignments, cursorRow, cursorCol) {
    const replacement = formatTable(rows, alignments);
    const nextValue = `${value.slice(0, table.start)}${replacement}${value.slice(table.end)}`;
    const cursor = getCellPosition(nextValue, table.start, cursorRow, cursorCol);
    return { value: nextValue, cursor };
  }

  function getCellPosition(value, tableStart, rowIndex, colIndex) {
    const lines = value.slice(tableStart).split("\n");
    const visualLineIndex = rowIndex === 0 ? 0 : rowIndex + 1;
    let offset = tableStart;
    for (let index = 0; index < visualLineIndex; index += 1) {
      offset += lines[index].length + 1;
    }
    const ranges = splitRowWithRanges(lines[visualLineIndex] || "");
    const cell = ranges[clamp(colIndex, 0, ranges.length - 1)];
    return offset + (cell ? cell.start : 2);
  }

  function moveCell(value, position, direction) {
    const table = analyze(value, position);
    if (!table) return null;
    let row = table.dataRowIndex;
    let col = table.colIndex + direction;
    const rows = table.rows.map((item) => item.slice());

    if (col >= table.columnCount) {
      col = 0;
      row += 1;
    } else if (col < 0) {
      row -= 1;
      col = table.columnCount - 1;
    }

    if (row >= rows.length) {
      rows.push(Array.from({ length: table.columnCount }, () => ""));
    }
    if (row < 0) row = 0;

    return replaceTable(value, table, rows, table.alignments, row, col);
  }

  function insertRow(value, position, where) {
    const table = analyze(value, position);
    if (!table) return null;
    const rows = table.rows.map((item) => item.slice());
    const target = where === "above" ? table.dataRowIndex : table.dataRowIndex + 1;
    rows.splice(target, 0, Array.from({ length: table.columnCount }, () => ""));
    return replaceTable(value, table, rows, table.alignments, target, table.colIndex);
  }

  function deleteRow(value, position) {
    const table = analyze(value, position);
    if (!table || table.rows.length <= 2) return null;
    const rows = table.rows.map((item) => item.slice());
    rows.splice(table.dataRowIndex, 1);
    return replaceTable(value, table, rows, table.alignments, Math.min(table.dataRowIndex, rows.length - 1), table.colIndex);
  }

  function insertColumn(value, position, where) {
    const table = analyze(value, position);
    if (!table) return null;
    const target = where === "left" ? table.colIndex : table.colIndex + 1;
    const rows = table.rows.map((row) => {
      const next = row.slice();
      next.splice(target, 0, "");
      return next;
    });
    const alignments = table.alignments.slice();
    alignments.splice(target, 0, "left");
    return replaceTable(value, table, rows, alignments, table.dataRowIndex, target);
  }

  function deleteColumn(value, position) {
    const table = analyze(value, position);
    if (!table || table.columnCount <= 1) return null;
    const rows = table.rows.map((row) => row.filter((_cell, index) => index !== table.colIndex));
    const alignments = table.alignments.filter((_alignment, index) => index !== table.colIndex);
    return replaceTable(value, table, rows, alignments, table.dataRowIndex, Math.min(table.colIndex, alignments.length - 1));
  }

  function setAlignment(value, position, alignment) {
    const table = analyze(value, position);
    if (!table) return null;
    const alignments = table.alignments.slice();
    alignments[table.colIndex] = alignment;
    return replaceTable(value, table, table.rows, alignments, table.dataRowIndex, table.colIndex);
  }

  function format(value, position) {
    const table = analyze(value, position);
    if (!table) return null;
    return replaceTable(value, table, table.rows, table.alignments, table.dataRowIndex, table.colIndex);
  }

  function createDefaultTable() {
    return {
      text: "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |",
      cursorOffset: 2
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  window.MDBasicsTableEditing = {
    analyze,
    createDefaultTable,
    deleteColumn,
    deleteRow,
    format,
    insertColumn,
    insertRow,
    moveCell,
    setAlignment
  };
})();
