(function () {
  function buildLineDiff(before, after, escapeHtml, options = {}) {
    const changesOnly = options.changesOnly !== false;
    if (before === after) {
      return `<div class="diff-empty">No changes from the saved version.</div>`;
    }

    const beforeLines = before.split(/\r?\n/);
    const afterLines = after.split(/\r?\n/);
    const max = Math.max(beforeLines.length, afterLines.length);
    const rows = [];

    for (let index = 0; index < max; index += 1) {
      const left = beforeLines[index];
      const right = afterLines[index];
      if (left === right) {
        if (changesOnly) continue;
        rows.push(`<div class="diff-line same" data-source-line="${index + 1}"><span>${index + 1}</span><code>${escapeHtml(left || "")}</code></div>`);
      } else {
        if (left !== undefined) rows.push(`<div class="diff-line removed" data-source-line="${index + 1}"><span>${index + 1}</span><code>- ${escapeHtml(left)}</code></div>`);
        if (right !== undefined) rows.push(`<div class="diff-line added" data-source-line="${index + 1}"><span>${index + 1}</span><code>+ ${escapeHtml(right)}</code></div>`);
      }
    }

    return rows.length ? rows.join("") : `<div class="diff-empty">No changed lines.</div>`;
  }

  window.MDBasicsDiff = { buildLineDiff };
})();
