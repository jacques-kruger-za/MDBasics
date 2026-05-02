(function () {
  function renderMarkdown(element, markdownToHtml, markdown) {
    element.innerHTML = markdownToHtml(markdown || "");
  }

  function getMarkdownBlocks(markdown) {
    const lines = (markdown || "").split(/\r?\n/);
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      while (index < lines.length && lines[index].trim() === "") index += 1;
      if (index >= lines.length) break;

      const start = index;
      const isFence = /^```/.test(lines[index].trim());
      if (isFence) {
        index += 1;
        while (index < lines.length && !/^```/.test(lines[index].trim())) index += 1;
        if (index < lines.length) index += 1;
      } else {
        index += 1;
        while (index < lines.length && lines[index].trim() !== "") index += 1;
      }

      blocks.push({
        line: start + 1,
        markdown: lines.slice(start, index).join("\n")
      });
    }

    return blocks;
  }

  function renderAnchoredMarkdown(element, markdownToHtml, markdown) {
    const blocks = getMarkdownBlocks(markdown);
    if (!blocks.length) {
      element.innerHTML = "";
      return;
    }
    element.innerHTML = blocks.map((block) => (
      `<section class="markdown-block" data-source-line="${block.line}">${markdownToHtml(block.markdown)}</section>`
    )).join("");
  }

  window.MDBasicsDisplay = { getMarkdownBlocks, renderAnchoredMarkdown, renderMarkdown };
})();
