(function () {
  const codeEditor = document.getElementById("codeEditor");
  const codeEditorWrap = document.getElementById("codeEditorWrap");
  const lineNumbers = document.getElementById("lineNumbers");
  const ghostText = document.getElementById("ghostText");
  const renderEditor = document.getElementById("renderEditor");
  const tabsEl = document.getElementById("tabs");
  const filePathEl = document.getElementById("filePath");
  const statusMessage = document.getElementById("statusMessage");
  const cursorPositionEl = document.getElementById("cursorPosition");
  const charCountEl = document.getElementById("charCount");
  const zoomLevelEl = document.getElementById("zoomLevel");
  const codeModeButton = document.getElementById("codeModeButton");
  const renderModeButton = document.getElementById("renderModeButton");
  const diffModeButton = document.getElementById("diffModeButton");
  const diffEditor = document.getElementById("diffEditor");
  const emptyState = document.getElementById("emptyState");
  const emptyOpenButton = document.getElementById("emptyOpenButton");
  const menuPanel = document.getElementById("menuPanel");
  const contextMenu = document.getElementById("contextMenu");
  const slashMenu = document.getElementById("slashMenu");

  const FEATURE_WYSIWYG = false;
  const FEATURE_DIFF = false;

  let activeId = null;
  let documents = [];
  let applyingHistory = false;
  let lineWrap = true;
  let showLineNumbers = false;
  let editorZoom = 100;
  let activeMenuName = null;
  let menuSearch = "";
  let menuSearchTimer = null;
  let slashIndex = 0;
  let slashSuppressed = false;
  let slashSearch = "";

  const slashCommands = [
    { label: "Heading 1", marker: "# ", syntax: "#", shortcut: "Ctrl+Shift+1" },
    { label: "Heading 2", marker: "## ", syntax: "##", shortcut: "Ctrl+Shift+2" },
    { label: "Heading 3", marker: "### ", syntax: "###", shortcut: "Ctrl+Shift+3" },
    { label: "Quote", marker: "> ", syntax: ">", shortcut: "Ctrl+Shift+4" },
    { label: "Bullet", marker: "- ", syntax: "-", shortcut: "Ctrl+Shift+5" },
    { label: "Numbered", marker: "numbered", syntax: "1.", shortcut: "Ctrl+Shift+6" },
    { label: "Task", marker: "- [ ] ", syntax: "- [ ]", shortcut: "Ctrl+Shift+7" },
    { label: "Line", marker: "---\n\n", syntax: "---", shortcut: "Ctrl+Shift+8", cursorOffset: 5 },
    { label: "Code Block", marker: "```\n\n```", syntax: "```", shortcut: "Ctrl+Shift+9", cursorOffset: 4 },
    { label: "Paragraph", marker: "paragraph", syntax: "¶", shortcut: "Ctrl+Shift+0" },
    { label: "Table", marker: "table", syntax: "|", shortcut: "Ctrl+Shift+T" }
  ];
  const defaultGhostText = `# Heading 1
## Heading 2
### Heading 3

Plain paragraph with **bold**, _italic_, <u>underline</u>, and \`inline code\`.

> Block quote

- Bullet item
1. Numbered item
- [ ] Task item

| Column 1 | Column 2 |
| --- | --- |
| Cell | Cell |

---

\`\`\`
Code block
\`\`\``;

  if (!window.mdb) {
    setStatus("App bridge failed to load. Restart MDBasics.");
    return;
  }

  parkInactiveModules();
  bindEvents();
  createDocument({ text: "" });

  function parkInactiveModules() {
    renderModeButton.hidden = !FEATURE_WYSIWYG;
    diffModeButton.hidden = !FEATURE_DIFF;
    renderEditor.hidden = true;
    diffEditor.hidden = true;
  }

  function createDocument({ title = "Untitled", filePath = null, text = "" } = {}) {
    const doc = {
      id: crypto.randomUUID(),
      title,
      filePath,
      text,
      undoStack: [],
      redoStack: [],
      dirty: false
    };
    documents.push(doc);
    setActive(doc.id);
  }

  function getActiveDoc() {
    return documents.find((doc) => doc.id === activeId);
  }

  function setActive(id) {
    activeId = id;
    const doc = getActiveDoc();
    if (!doc) return;
    codeEditor.value = doc.text;
    updateChrome();
  }

  function updateChrome() {
    const doc = getActiveDoc();
    tabsEl.innerHTML = "";

    documents.forEach((item) => {
      const tab = document.createElement("div");
      tab.className = `tab ${item.id === activeId ? "active" : ""}`;
      tab.role = "tab";
      tab.title = item.filePath || item.title;
      tab.innerHTML = `<button class="tab-title" type="button">${escapeHtml(item.title)}${item.dirty ? " *" : ""}</button><button class="tab-close" type="button" aria-label="Close ${escapeHtml(item.title)}">×</button>`;
      tab.addEventListener("click", (event) => {
        if (event.target.classList.contains("tab-close")) {
          closeDocument(item.id);
        } else {
          setActive(item.id);
        }
      });
      tabsEl.appendChild(tab);
    });

    filePathEl.textContent = doc?.filePath || doc?.title || "No document";
    charCountEl.textContent = `${doc?.text.length || 0} chars`;
    emptyState.hidden = Boolean(doc);
    codeEditorWrap.hidden = !doc;
    codeModeButton.classList.toggle("active", Boolean(doc));
    codeModeButton.disabled = !doc;
    updateGhostText();
    updateCursorStatus();
    updateLineNumbers();
  }

  function updateGhostText() {
    const doc = getActiveDoc();
    const showGhost = Boolean(doc) && doc.text.length === 0 && codeEditor.value.length === 0;
    ghostText.textContent = showGhost ? defaultGhostText : "";
    ghostText.hidden = !showGhost;
  }

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function closeDocument(id) {
    if (!id || documents.length === 0) return;

    if (documents.length === 1) {
      documents = [];
      activeId = null;
      codeEditor.value = "";
      updateChrome();
      return;
    }

    const index = documents.findIndex((doc) => doc.id === id);
    documents = documents.filter((doc) => doc.id !== id);
    if (activeId === id) {
      setActive(documents[Math.max(0, index - 1)].id);
    } else {
      updateChrome();
    }
  }

  function setText(text, trackHistory = true) {
    const doc = getActiveDoc();
    if (!doc || doc.text === text) return;
    if (trackHistory && !applyingHistory) {
      doc.undoStack.push(doc.text);
      doc.redoStack = [];
      if (doc.undoStack.length > 200) doc.undoStack.shift();
    }
    doc.text = text;
    doc.dirty = true;
    updateChrome();
  }

  function undo() {
    const doc = getActiveDoc();
    if (!doc || doc.undoStack.length === 0) return;
    doc.redoStack.push(doc.text);
    applyingHistory = true;
    applyText(doc.undoStack.pop());
    applyingHistory = false;
  }

  function redo() {
    const doc = getActiveDoc();
    if (!doc || doc.redoStack.length === 0) return;
    doc.undoStack.push(doc.text);
    applyingHistory = true;
    applyText(doc.redoStack.pop());
    applyingHistory = false;
  }

  function applyText(text) {
    const doc = getActiveDoc();
    if (!doc) return;
    doc.text = text;
    doc.dirty = true;
    codeEditor.value = text;
    updateChrome();
  }

  async function openFiles() {
    closeMenuPanel();
    try {
      setStatus("Opening...");
      const files = await window.mdb.openFiles();
      if (!files.length) {
        setStatus("Open cancelled");
        return;
      }
      files.forEach(addOpenedFile);
      setStatus(`Opened ${files.length} file${files.length === 1 ? "" : "s"}`);
    } catch (error) {
      console.error(error);
      setStatus(`Open failed: ${error.message || "Unknown error"}`);
    }
  }

  async function openPath(filePath) {
    try {
      const file = await window.mdb.readFile(filePath);
      addOpenedFile(file);
      setStatus("Opened file");
    } catch (error) {
      console.error(error);
      setStatus(`Open failed: ${error.message || "Unknown error"}`);
    }
  }

  function addOpenedFile(file) {
    createDocument({
      title: file.filePath.split(/[\\/]/).pop(),
      filePath: file.filePath,
      text: file.text
    });
    getActiveDoc().dirty = false;
    updateChrome();
  }

  async function saveActive(saveAs = false) {
    const doc = getActiveDoc();
    if (!doc) return;
    closeMenuPanel();
    try {
      const saved = await window.mdb.saveFile({
        filePath: saveAs ? null : doc.filePath,
        suggestedName: `${doc.title.replace(/\s+/g, "-")}.md`,
        text: doc.text
      });
      if (!saved) {
        setStatus("Save cancelled");
        return;
      }
      doc.filePath = saved.filePath;
      doc.title = saved.filePath.split(/[\\/]/).pop();
      doc.dirty = false;
      updateChrome();
      setStatus("Saved");
    } catch (error) {
      console.error(error);
      setStatus(`Save failed: ${error.message || "Unknown error"}`);
    }
  }

  function currentMarkdown() {
    return getActiveDoc()?.text || "";
  }

  function currentHtmlDocument() {
    const doc = getActiveDoc();
    if (!doc) return "";
    const title = escapeHtml(doc.title.replace(/\.(md|markdown|mdown|mkd)$/i, ""));
    const body = window.mdb.markdownToHtml(doc.text || "");
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { color: #202124; font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 48px auto; max-width: 860px; padding: 0 32px; }
    h1, h2, h3 { line-height: 1.18; }
    pre { background: #f4f4f2; border: 1px solid #ddd; border-radius: 8px; overflow: auto; padding: 14px; }
    code { font-family: "Cascadia Code", Consolas, monospace; }
    blockquote { border-left: 3px solid #0c8f7d; color: #666b74; margin-left: 0; padding-left: 16px; }
    li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.4em; }
    li > input[type="checkbox"] { margin-right: 0.55em; transform: translateY(0.08em); }
    img { max-width: 100%; }
  </style>
</head>
<body>${body}</body>
</html>`;
  }

  function suggestedExportName(extension) {
    const base = (getActiveDoc()?.title || "Untitled").replace(/\.(md|markdown|mdown|mkd)$/i, "");
    return `${base}.${extension}`;
  }

  async function exportHtml() {
    closeMenuPanel();
    await runWithStatus("Exported HTML", "HTML export failed", () => (
      window.mdb.exportHtml({ html: currentHtmlDocument(), suggestedName: suggestedExportName("html") })
    ));
  }

  async function exportPdf() {
    closeMenuPanel();
    await runWithStatus("Exported PDF", "PDF export failed", () => (
      window.mdb.exportPdf({ html: currentHtmlDocument(), suggestedName: suggestedExportName("pdf") })
    ));
  }

  async function exportWord() {
    closeMenuPanel();
    await runWithStatus("Exported Word", "Word export failed", () => (
      window.mdb.exportWord({ markdown: currentMarkdown(), suggestedName: suggestedExportName("docx") })
    ));
  }

  async function printDocument() {
    closeMenuPanel();
    await runWithStatus("Print sent", "Print failed", () => (
      window.mdb.printDocument({ html: currentHtmlDocument() })
    ));
  }

  async function runWithStatus(successMessage, failureMessage, action) {
    try {
      setStatus("Working...");
      const result = await action();
      setStatus(result ? successMessage : "Cancelled");
    } catch (error) {
      console.error(error);
      setStatus(`${failureMessage}: ${error.message || "Unknown error"}`);
    }
  }

  function openMenuPanel(menuName, anchor) {
    const menus = {
      file: [
        ["New Tab", () => createDocument()],
        ["Close Tab", () => closeDocument(activeId)],
        ["Open...", openFiles],
        ["Save", () => saveActive(false)],
        ["Save As...", () => saveActive(true)],
        ["Print...", printDocument],
        ["Export HTML", exportHtml],
        ["Export PDF", exportPdf],
        ["Export Word", exportWord]
      ],
      edit: [
        ["Undo", undo],
        ["Redo", redo],
        ["Bold", () => wrapCodeSelection("**", "**")],
        ["Italic", () => wrapCodeSelection("_", "_")],
        ["Underline", () => wrapCodeSelection("<u>", "</u>")]
      ],
      view: [
        ["Code", () => setStatus("Code mode active")],
        ["Rendered", () => setStatus("Rendered mode is parked")],
        ["Diff", () => setStatus("Diff mode is parked")]
      ],
      settings: [
        [document.body.classList.contains("light") ? "Dark Mode" : "Light Mode", toggleTheme],
        [document.body.classList.contains("glass") ? "Disable Glass" : "Enable Glass", toggleGlass],
        [lineWrap ? "Disable Line Wrap" : "Enable Line Wrap", toggleLineWrap],
        [showLineNumbers ? "Hide Line Numbers" : "Show Line Numbers", toggleLineNumbers]
      ]
    };

    menuPanel.innerHTML = "";
    menus[menuName].forEach(([label, action]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = label;
      item.dataset.menuLabel = label.toLowerCase();
      item.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        action();
        closeMenuPanel();
      });
      menuPanel.appendChild(item);
    });

    const rect = anchor.getBoundingClientRect();
    menuPanel.style.left = `${rect.left}px`;
    menuPanel.style.top = `${rect.bottom + 2}px`;
    menuPanel.hidden = false;
    activeMenuName = menuName;
    menuSearch = "";
  }

  function closeMenuPanel() {
    menuPanel.hidden = true;
    activeMenuName = null;
    menuSearch = "";
  }

  function toggleTheme() {
    closeMenuPanel();
    document.body.classList.toggle("light");
    window.mdb.setTitlebarTheme(document.body.classList.contains("light") ? "light" : "dark");
  }

  function toggleGlass() {
    closeMenuPanel();
    document.body.classList.toggle("glass");
  }

  function toggleLineWrap() {
    closeMenuPanel();
    lineWrap = !lineWrap;
    codeEditor.classList.toggle("no-wrap", !lineWrap);
    updateLineNumbers();
  }

  function toggleLineNumbers() {
    closeMenuPanel();
    showLineNumbers = !showLineNumbers;
    codeEditorWrap.classList.toggle("show-lines", showLineNumbers);
    updateLineNumbers();
  }

  function updateCursorStatus() {
    const value = codeEditor.value;
    const cursor = codeEditor.selectionStart || 0;
    const before = value.slice(0, cursor);
    const line = before.split(/\r?\n/).length;
    const lastBreak = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
    const col = cursor - lastBreak;
    cursorPositionEl.textContent = `Ln ${line}, Col ${col}`;
  }

  function updateLineNumbers() {
    if (!showLineNumbers) {
      lineNumbers.textContent = "";
      return;
    }
    const count = Math.max(1, codeEditor.value.split(/\r?\n/).length);
    lineNumbers.textContent = Array.from({ length: count }, (_item, index) => String(index + 1)).join("\n");
    lineNumbers.scrollTop = codeEditor.scrollTop;
  }

  function setEditorZoom(nextZoom) {
    editorZoom = Math.min(180, Math.max(70, nextZoom));
    codeEditorWrap.style.setProperty("--editor-font-size", `${15 * (editorZoom / 100)}px`);
    zoomLevelEl.textContent = `${editorZoom}%`;
    updateLineNumbers();
  }

  function handleCodeKeydown(event) {
    if (handleSlashKeydown(event)) return;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && /^Digit[0-9]$/.test(event.code)) {
      const command = getShortcutCommand(event.code.replace("Digit", ""));
      if (command) {
        event.preventDefault();
        applyLineCommand(command, false);
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      applyLineCommand(slashCommands.find((command) => command.marker === "table"), false);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === "enter" && exitTable(event)) return;
      if (key === "b") {
        event.preventDefault();
        wrapCodeSelection("**", "**");
        return;
      }
      if (key === "i") {
        event.preventDefault();
        wrapCodeSelection("_", "_");
        return;
      }
      if (key === "u") {
        event.preventDefault();
        wrapCodeSelection("<u>", "</u>");
        return;
      }
    }
    if ((event.key === " " || event.key === "Enter") && exitInlineFormatting(event)) return;
    if (event.key === "Tab" && handleTableTab(event)) return;
    if (event.key === "Enter" && handleTableEnter(event)) return;
    if (event.key === "Enter" && handleMarkdownEnter(event)) return;
    if (event.key === "Tab") insertCodeTab(event);
  }

  function getShortcutCommand(key) {
    const index = key === "0" ? 9 : Number(key) - 1;
    return slashCommands[index];
  }

  function handleMarkdownEnter(event) {
    const info = getCurrentLineInfo();
    const line = info.line;
    const trimmed = line.trim();

    if (isInsideCodeFence(codeEditor.value, info.start)) {
      event.preventDefault();
      insertAtSelection("\n");
      return true;
    }

    const task = line.match(/^(\s*)-\s\[[ xX]\]\s(.*)$/);
    if (task) {
      event.preventDefault();
      if (task[2].trim() === "") {
        replaceRange(info.start, info.end, "");
        setSelection(info.start);
        return true;
      }
      insertAtSelection(`\n${task[1]}- [ ] `);
      return true;
    }

    const numbered = line.match(/^(\s*)(\d+)\.\s(.*)$/);
    if (numbered) {
      event.preventDefault();
      if (numbered[3].trim() === "") {
        replaceRange(info.start, info.end, "");
        setSelection(info.start);
        return true;
      }
      insertAtSelection(`\n${numbered[1]}${Number(numbered[2]) + 1}. `);
      return true;
    }

    const bullet = line.match(/^(\s*)([-*+])\s(.*)$/);
    if (bullet) {
      event.preventDefault();
      if (bullet[3].trim() === "") {
        replaceRange(info.start, info.end, "");
        setSelection(info.start);
        return true;
      }
      insertAtSelection(`\n${bullet[1]}${bullet[2]} `);
      return true;
    }

    const quote = line.match(/^(\s*>\s?)(.*)$/);
    if (quote) {
      event.preventDefault();
      if (quote[2].trim() === "") {
        replaceRange(info.start, info.end, "");
        setSelection(info.start);
        return true;
      }
      insertAtSelection(`\n${quote[1]}`);
      return true;
    }

    if (/^```/.test(trimmed)) {
      event.preventDefault();
      insertAtSelection("\n");
      return true;
    }

    return false;
  }

  function getCurrentLineInfo() {
    const value = codeEditor.value;
    const cursor = codeEditor.selectionStart;
    const start = value.lastIndexOf("\n", cursor - 1) + 1;
    const nextBreak = value.indexOf("\n", cursor);
    const end = nextBreak === -1 ? value.length : nextBreak;
    return { start, end, line: value.slice(start, end), cursor };
  }

  function isInsideCodeFence(value, position) {
    const before = value.slice(0, position).split(/\r?\n/);
    let open = false;
    for (const line of before) {
      if (/^\s*```/.test(line)) open = !open;
    }
    return open;
  }

  function insertCodeTab(event) {
    event.preventDefault();
    insertAtSelection("\t");
  }

  function handleTableTab(event) {
    if (!window.MDBasicsTableEditing) return false;
    const result = window.MDBasicsTableEditing.moveCell(
      codeEditor.value,
      codeEditor.selectionStart,
      event.shiftKey ? -1 : 1
    );
    if (!result) return false;
    event.preventDefault();
    applyTableResult(result, "Table cell");
    return true;
  }

  function handleTableEnter(event) {
    if (!window.MDBasicsTableEditing) return false;
    const result = window.MDBasicsTableEditing.insertRow(codeEditor.value, codeEditor.selectionStart, "below");
    if (!result) return false;
    event.preventDefault();
    applyTableResult(result, "Inserted table row");
    return true;
  }

  function exitTable(event) {
    if (!window.MDBasicsTableEditing) return false;
    const table = window.MDBasicsTableEditing.analyze(codeEditor.value, codeEditor.selectionStart);
    if (!table) return false;
    event.preventDefault();
    const insertionPoint = table.end;
    const suffix = codeEditor.value[insertionPoint] === "\n" ? "\n" : "\n\n";
    codeEditor.value = `${codeEditor.value.slice(0, insertionPoint)}${suffix}${codeEditor.value.slice(insertionPoint)}`;
    setSelection(insertionPoint + suffix.length);
    setText(codeEditor.value);
    setStatus("Exited table");
    return true;
  }

  function insertAtSelection(text) {
    const start = codeEditor.selectionStart;
    replaceRange(start, codeEditor.selectionEnd, text);
    setSelection(start + text.length);
  }

  function replaceRange(start, end, text) {
    const value = codeEditor.value;
    codeEditor.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
    setText(codeEditor.value);
  }

  function setSelection(position) {
    codeEditor.selectionStart = position;
    codeEditor.selectionEnd = position;
  }

  function showContextMenu(event) {
    event.preventDefault();
    closeMenuPanel();
    closeContextMenu();
    contextMenu.innerHTML = "";
    addContextButton("Copy", () => document.execCommand("copy"));
    addContextButton("Paste", () => document.execCommand("paste"));
    addContextSeparator();
    addContextButton("Bold", () => wrapCodeSelection("**", "**"));
    addContextButton("Italic", () => wrapCodeSelection("_", "_"));
    addContextButton("Underline", () => wrapCodeSelection("<u>", "</u>"));
    addContextButton("Code", () => wrapCodeSelection("`", "`"));
    addContextButton("Quote Line", () => prefixCurrentLine("> "));
    addContextButton("Bullet Line", () => prefixCurrentLine("- "));

    const tableItems = getTableContextItems();
    if (tableItems.length) {
      addContextSeparator();
      addContextSubmenu("Tables", tableItems);
    }

    contextMenu.classList.remove("submenu-left");
    contextMenu.hidden = false;
    const rect = contextMenu.getBoundingClientRect();
    const left = clamp(event.clientX, 8, window.innerWidth - rect.width - 8);
    if (left + rect.width + 210 > window.innerWidth) contextMenu.classList.add("submenu-left");
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${clamp(event.clientY, 8, window.innerHeight - rect.height - 8)}px`;
  }

  function closeContextMenu() {
    contextMenu.hidden = true;
    contextMenu.classList.remove("submenu-left");
  }

  function addContextSeparator() {
    const separator = document.createElement("div");
    separator.className = "menu-separator";
    contextMenu.appendChild(separator);
  }

  function addContextButton(label, action, parent = contextMenu) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = label;
    item.addEventListener("pointerdown", (pointerEvent) => {
      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      action();
      closeContextMenu();
    });
    parent.appendChild(item);
    return item;
  }

  function addContextSubmenu(label, items) {
    const wrapper = document.createElement("div");
    wrapper.className = "submenu-wrap";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "submenu-trigger";
    trigger.innerHTML = `<span>${escapeHtml(label)}</span><span aria-hidden="true">›</span>`;
    const submenu = document.createElement("div");
    submenu.className = "menu-panel submenu-panel";
    items.forEach(([itemLabel, action]) => addContextButton(itemLabel, action, submenu));
    wrapper.appendChild(trigger);
    wrapper.appendChild(submenu);
    contextMenu.appendChild(wrapper);
  }

  function getTableContextItems() {
    if (!window.MDBasicsTableEditing?.analyze(codeEditor.value, codeEditor.selectionStart)) return [];
    return [
      ["Format Table", () => runTableCommand("format")],
      ["Insert Row Above", () => runTableCommand("insertRow", "above")],
      ["Insert Row Below", () => runTableCommand("insertRow", "below")],
      ["Delete Row", () => runTableCommand("deleteRow")],
      ["Insert Column Left", () => runTableCommand("insertColumn", "left")],
      ["Insert Column Right", () => runTableCommand("insertColumn", "right")],
      ["Delete Column", () => runTableCommand("deleteColumn")],
      ["Align Left", () => runTableCommand("setAlignment", "left")],
      ["Align Center", () => runTableCommand("setAlignment", "center")],
      ["Align Right", () => runTableCommand("setAlignment", "right")]
    ];
  }

  function runTableCommand(commandName, argument) {
    const table = window.MDBasicsTableEditing;
    if (!table) return;
    const result = table[commandName](codeEditor.value, codeEditor.selectionStart, argument);
    if (!result) {
      setStatus("No table action available");
      return;
    }
    applyTableResult(result, "Updated table");
  }

  function applyTableResult(result, message) {
    codeEditor.value = result.value;
    setSelection(result.cursor);
    setText(codeEditor.value);
    codeEditor.focus();
    setStatus(message);
  }

  function wrapCodeSelection(before, after) {
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;
    const value = codeEditor.value;
    const selected = value.slice(start, end);
    const replacement = `${before}${selected}${after}`;
    codeEditor.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    codeEditor.selectionStart = start + before.length;
    codeEditor.selectionEnd = start + before.length + selected.length;
    setText(codeEditor.value);
    codeEditor.focus();
  }

  function exitInlineFormatting(event) {
    if (codeEditor.selectionStart !== codeEditor.selectionEnd) return false;
    const formats = [
      { before: "**", after: "**" },
      { before: "_", after: "_" },
      { before: "<u>", after: "</u>" },
      { before: "`", after: "`" }
    ];
    const cursor = codeEditor.selectionStart;
    const value = codeEditor.value;
    const format = formats.find((item) => value.startsWith(item.after, cursor));
    if (!format) return false;

    event.preventDefault();
    const separator = event.key === "Enter" ? "\n" : " ";
    const beforeStart = cursor - format.before.length;
    const isEmptyWrapper = beforeStart >= 0 && value.slice(beforeStart, cursor) === format.before;

    if (isEmptyWrapper) {
      codeEditor.value = `${value.slice(0, beforeStart)}${separator}${value.slice(cursor + format.after.length)}`;
      setSelection(beforeStart + separator.length);
    } else {
      codeEditor.value = `${value.slice(0, cursor + format.after.length)}${separator}${value.slice(cursor + format.after.length)}`;
      setSelection(cursor + format.after.length + separator.length);
    }
    setText(codeEditor.value);
    return true;
  }

  function prefixCurrentLine(prefix) {
    const value = codeEditor.value;
    const lineStart = value.lastIndexOf("\n", codeEditor.selectionStart - 1) + 1;
    codeEditor.value = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    codeEditor.selectionStart += prefix.length;
    codeEditor.selectionEnd += prefix.length;
    setText(codeEditor.value);
    codeEditor.focus();
  }

  function maybeShowSlashMenu() {
    const start = codeEditor.selectionStart;
    const value = codeEditor.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const linePrefix = value.slice(lineStart, start);
    if (!linePrefix.startsWith("/")) {
      slashSuppressed = false;
      hideSlashMenu();
      return;
    }
    if (slashSuppressed) return;

    renderSlashMenu();
    const rect = getTextareaCaretRect(codeEditor);
    slashMenu.hidden = false;
    const menuRect = slashMenu.getBoundingClientRect();
    const editorRect = codeEditor.getBoundingClientRect();
    const left = clamp(rect.left, editorRect.left + 8, window.innerWidth - menuRect.width - 8);
    const below = rect.bottom + 6;
    const above = rect.top - menuRect.height - 6;
    const top = below + menuRect.height > window.innerHeight - 8 ? Math.max(editorRect.top + 8, above) : below;
    slashMenu.style.left = `${left}px`;
    slashMenu.style.top = `${top}px`;
  }

  function renderSlashMenu() {
    slashMenu.innerHTML = "";
    getFilteredSlashCommands().forEach((command, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = index === slashIndex ? "active" : "";
      item.innerHTML = `<small class="slash-syntax">${escapeHtml(command.syntax)}</small><span>${escapeHtml(command.label)}</span><small class="slash-shortcut">${escapeHtml(command.shortcut)}</small>`;
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyLineCommand(command, true);
      });
      slashMenu.appendChild(item);
    });
  }

  function getFilteredSlashCommands() {
    if (!slashSearch) return slashCommands;
    const query = slashSearch.toLowerCase();
    const startsWith = slashCommands.filter((command) => command.label.toLowerCase().startsWith(query));
    if (startsWith.length) return startsWith;
    const filtered = slashCommands.filter((command) => command.label.toLowerCase().includes(query));
    return filtered.length ? filtered : slashCommands;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getTextareaCaretRect(textarea) {
    const textareaRect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    [
      "boxSizing", "width", "height", "overflowX", "overflowY", "borderTopWidth",
      "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "paddingTop",
      "paddingRight", "paddingBottom", "paddingLeft", "fontStyle", "fontVariant",
      "fontWeight", "fontStretch", "fontSize", "fontSizeAdjust", "lineHeight",
      "fontFamily", "textAlign", "textTransform", "textIndent", "textDecoration",
      "letterSpacing", "wordSpacing", "tabSize", "MozTabSize", "whiteSpace"
    ].forEach((property) => {
      mirror.style[property] = style[property];
    });
    mirror.style.position = "fixed";
    mirror.style.visibility = "hidden";
    mirror.style.left = `${textareaRect.left}px`;
    mirror.style.top = `${textareaRect.top}px`;
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";

    const marker = document.createElement("span");
    mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
    marker.textContent = "\u200b";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const markerRect = marker.getBoundingClientRect();
    document.body.removeChild(mirror);

    const left = markerRect.left - textarea.scrollLeft;
    const top = markerRect.top - textarea.scrollTop;
    return {
      left: Math.min(left, textareaRect.right - 220),
      top,
      bottom: top + parseFloat(style.lineHeight || "20")
    };
  }

  function hideSlashMenu() {
    slashMenu.hidden = true;
    slashSearch = "";
  }

  function moveSlashSelection(direction) {
    const commands = getFilteredSlashCommands();
    slashIndex = (slashIndex + direction + commands.length) % commands.length;
    Array.from(slashMenu.children).forEach((child, index) => {
      child.classList.toggle("active", index === slashIndex);
    });
  }

  function handleSlashKeydown(event) {
    if (slashMenu.hidden) return false;
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      slashSearch += event.key;
      slashIndex = 0;
      renderSlashMenu();
      return true;
    }
    if (event.key === "Backspace" && slashSearch) {
      event.preventDefault();
      slashSearch = slashSearch.slice(0, -1);
      slashIndex = 0;
      renderSlashMenu();
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSlashSelection(event.key === "ArrowDown" ? 1 : -1);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      applyLineCommand(getFilteredSlashCommands()[slashIndex], true);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      slashSuppressed = true;
      hideSlashMenu();
      return true;
    }
    return false;
  }

  function handleTopMenuTypeahead(event) {
    if (menuPanel.hidden) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuPanel();
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveTopMenuSelection(event.key === "ArrowDown" ? 1 : -1);
      return true;
    }
    if (event.key === "Enter") {
      const active = menuPanel.querySelector("button.active") || menuPanel.querySelector("button");
      if (active) {
        event.preventDefault();
        active.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        return true;
      }
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      menuSearch += event.key.toLowerCase();
      clearTimeout(menuSearchTimer);
      menuSearchTimer = setTimeout(() => {
        menuSearch = "";
      }, 800);
      jumpTopMenu(menuSearch);
      return true;
    }
    return false;
  }

  function moveTopMenuSelection(direction) {
    const items = Array.from(menuPanel.querySelectorAll("button"));
    if (!items.length) return;
    const current = items.findIndex((item) => item.classList.contains("active"));
    const next = (current + direction + items.length) % items.length;
    items.forEach((item, index) => item.classList.toggle("active", index === next));
  }

  function jumpTopMenu(query) {
    const items = Array.from(menuPanel.querySelectorAll("button"));
    const target = items.find((item) => item.dataset.menuLabel.startsWith(query))
      || items.find((item) => item.dataset.menuLabel.includes(query));
    if (!target) return;
    items.forEach((item) => item.classList.toggle("active", item === target));
    target.scrollIntoView({ block: "nearest" });
  }

  function applyLineCommand(command, stripSlash) {
    if (!command) return;
    const start = codeEditor.selectionStart;
    const value = codeEditor.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", start);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const line = value.slice(lineStart, lineEnd);
    const text = stripBlockMarker(stripSlash ? line.replace(/^\/\w*\s*/, "") : line);

    if (command.marker === "paragraph") {
      codeEditor.value = `${value.slice(0, lineStart)}${text}${value.slice(lineEnd)}`;
      const cursor = lineStart + text.length;
      codeEditor.selectionStart = cursor;
      codeEditor.selectionEnd = cursor;
      setText(codeEditor.value);
      slashSuppressed = false;
      hideSlashMenu();
      codeEditor.focus();
      return;
    }

    if (command.marker === "table") {
      const table = window.MDBasicsTableEditing.createDefaultTable();
      const prefix = lineStart > 0 && value[lineStart - 1] !== "\n" ? "\n" : "";
      const suffix = lineEnd < value.length && value[lineEnd] !== "\n" ? "\n" : "";
      const replacement = `${prefix}${table.text}${suffix}`;
      codeEditor.value = `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`;
      const cursor = lineStart + prefix.length + table.cursorOffset;
      codeEditor.selectionStart = cursor;
      codeEditor.selectionEnd = cursor;
      setText(codeEditor.value);
      slashSuppressed = false;
      hideSlashMenu();
      codeEditor.focus();
      setStatus("Inserted table");
      return;
    }

    const marker = command.marker === "numbered" ? `${getNextListNumberBefore(lineStart)}. ` : command.marker;
    const replacement = marker.includes("\n") ? marker : `${marker}${text}`;
    codeEditor.value = `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`;
    const cursor = lineStart + (command.cursorOffset ?? replacement.length);
    codeEditor.selectionStart = cursor;
    codeEditor.selectionEnd = cursor;
    setText(codeEditor.value);
    slashSuppressed = false;
    hideSlashMenu();
    codeEditor.focus();
  }

  function stripBlockMarker(line) {
    return line
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s{0,3}>\s?/, "")
      .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "");
  }

  function getNextListNumberBefore(position) {
    const lines = codeEditor.value.slice(0, position).split(/\r?\n/).reverse();
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\.\s/);
      if (match) return Number(match[1]) + 1;
      if (line.trim() !== "") break;
    }
    return 1;
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function bindEvents() {
    document.getElementById("newTabButton").addEventListener("click", () => createDocument());
    emptyOpenButton.addEventListener("click", openFiles);
    codeModeButton.addEventListener("click", () => setStatus("Code mode active"));
    renderModeButton.addEventListener("click", () => setStatus("Rendered mode is parked"));
    diffModeButton.addEventListener("click", () => setStatus("Diff mode is parked"));
    document.querySelectorAll("[data-menu]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        openMenuPanel(button.dataset.menu, button);
      });
      button.addEventListener("mouseenter", () => {
        if (activeMenuName) openMenuPanel(button.dataset.menu, button);
      });
    });
    window.addEventListener("pointerdown", (event) => {
      if (!menuPanel.contains(event.target)) closeMenuPanel();
      if (!contextMenu.contains(event.target)) closeContextMenu();
      if (!slashMenu.contains(event.target) && event.target !== codeEditor) hideSlashMenu();
    });

    codeEditor.addEventListener("input", () => setText(codeEditor.value));
    codeEditor.addEventListener("keyup", maybeShowSlashMenu);
    codeEditor.addEventListener("click", updateCursorStatus);
    codeEditor.addEventListener("select", updateCursorStatus);
    codeEditor.addEventListener("scroll", () => {
      lineNumbers.scrollTop = codeEditor.scrollTop;
    });
    codeEditor.addEventListener("wheel", (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setEditorZoom(editorZoom + (event.deltaY < 0 ? 10 : -10));
    }, { passive: false });
    codeEditor.addEventListener("contextmenu", showContextMenu);
    codeEditor.addEventListener("keydown", handleCodeKeydown);
    window.addEventListener("keydown", handleGlobalKeydown);
    window.mdb.onOpenPath(openPath);
  }

  function handleGlobalKeydown(event) {
    if (handleTopMenuTypeahead(event)) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      redo();
    } else if (key === "o") {
      event.preventDefault();
      openFiles();
    } else if (key === "s" && !event.shiftKey) {
      event.preventDefault();
      saveActive(false);
    } else if (key === "s" && event.shiftKey) {
      event.preventDefault();
      saveActive(true);
    } else if (key === "p") {
      event.preventDefault();
      printDocument();
    } else if (key === "n") {
      event.preventDefault();
      createDocument();
    } else if (key === "w") {
      event.preventDefault();
      closeDocument(activeId);
    }
  }
})();
