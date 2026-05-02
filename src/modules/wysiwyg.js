(function () {
  function createToastEditor({ element, initialValue = "", onChange }) {
    if (!window.toastui?.Editor) {
      throw new Error("Toast UI editor is not loaded. WYSIWYG is currently parked.");
    }

    const editor = new toastui.Editor({
      el: element,
      initialValue,
      initialEditType: "wysiwyg",
      previewStyle: "tab",
      height: "100%",
      usageStatistics: false,
      hideModeSwitch: true,
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task"],
        ["table", "link"],
        ["code", "codeblock"]
      ]
    });

    if (onChange) editor.on("change", () => onChange(editor.getMarkdown()));
    return editor;
  }

  window.MDBasicsWysiwyg = { createToastEditor };
})();
