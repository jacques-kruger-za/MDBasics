(function () {
  function buildLineDiff(before, after, escapeHtml) {
    const beforeLines = before.split(/\r?\n/);
    const afterLines = after.split(/\r?\n/);
    const max = Math.max(beforeLines.length, afterLines.length);
    const rows = [];

    for (let index = 0; index < max; index += 1) {
      const left = beforeLines[index];
      const right = afterLines[index];
      if (left === right) {
        rows.push(`<div class="diff-line same"><span>${index + 1}</span><code>${escapeHtml(left || "")}</code></div>`);
      } else {
        if (left !== undefined) rows.push(`<div class="diff-line removed"><span>${index + 1}</span><code>- ${escapeHtml(left)}</code></div>`);
        if (right !== undefined) rows.push(`<div class="diff-line added"><span>${index + 1}</span><code>+ ${escapeHtml(right)}</code></div>`);
      }
    }

    return rows.length ? rows.join("") : `<div class="diff-empty">No changes yet.</div>`;
  }

  window.MDBasicsDiff = { buildLineDiff };
})();
