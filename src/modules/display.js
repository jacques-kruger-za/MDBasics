(function () {
  function renderMarkdown(element, markdownToHtml, markdown) {
    element.innerHTML = markdownToHtml(markdown || "");
  }

  window.MDBasicsDisplay = { renderMarkdown };
})();
