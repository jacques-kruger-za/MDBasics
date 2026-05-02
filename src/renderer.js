(function () {
  const tabsEl = document.getElementById("tabs");
  const filePathEl = document.getElementById("filePath");
  const statusMessage = document.getElementById("statusMessage");
  const cursorPositionEl = document.getElementById("cursorPosition");
  const charCountEl = document.getElementById("charCount");
  const zoomLevelEl = document.getElementById("zoomLevel");
  const emptyState = document.getElementById("emptyState");
  const emptyOpenButton = document.getElementById("emptyOpenButton");
  const menuPanel = document.getElementById("menuPanel");
  const contextMenu = document.getElementById("contextMenu");
  const slashMenu = document.getElementById("slashMenu");
  const documentToolbar = document.getElementById("documentToolbar");
  const paneArea = document.getElementById("paneArea");
  const rightInspector = document.getElementById("rightInspector");
  const diffInspectorContent = document.getElementById("diffInspectorContent");

  const singleLayoutButton = document.getElementById("singleLayoutButton");
  const splitLayoutButton = document.getElementById("splitLayoutButton");
  const paneSelector = document.getElementById("paneSelector");
  const primaryPaneButton = document.getElementById("primaryPaneButton");
  const secondaryPaneButton = document.getElementById("secondaryPaneButton");
  const paneCodeButton = document.getElementById("paneCodeButton");
  const panePreviewButton = document.getElementById("panePreviewButton");
  const paneSyncButton = document.getElementById("paneSyncButton");
  const diffInspectorButton = document.getElementById("diffInspectorButton");
  const diffFollowButton = document.getElementById("diffFollowButton");
  const closeInspectorButton = document.getElementById("closeInspectorButton");

  const PANE_PRIMARY = "primary";
  const PANE_SECONDARY = "secondary";
  const VIEW_CODE = "code";
  const VIEW_PREVIEW = "preview";

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
  let contextFloatingMenus = [];
  let submenuCloseTimer = null;
  let inspectorOpen = false;
  let diffFollowLocked = true;
  let paneSyncing = false;

  const paneNodes = new Map();
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

  if (!window.mdb) {
    setStatus("App bridge failed to load. Restart MDBasics.");
    return;
  }

  bindEvents();
  createDocument({ text: "" });

  function createPaneState(view = VIEW_CODE) {
    return { view, cursor: 0, selectionEnd: 0, scrollTop: 0, sourceLine: 1 };
  }

  function createDocument({ title = "Untitled", filePath = null, text = "" } = {}) {
    const doc = {
      id: crypto.randomUUID(),
      title,
      filePath,
      text,
      savedText: text,
      undoStack: [],
      redoStack: [],
      dirty: false,
      layoutMode: "single",
      activePane: PANE_PRIMARY,
      paneSyncLocked: true,
      panes: {
        primary: createPaneState(VIEW_CODE),
        secondary: createPaneState(VIEW_PREVIEW)
      }
    };
    documents.push(doc);
    setActive(doc.id);
  }

  function getActiveDoc() {
    return documents.find((doc) => doc.id === activeId);
  }

  function getVisiblePaneIds(doc = getActiveDoc()) {
    if (!doc) return [];
    return doc.layoutMode === "split" ? [PANE_PRIMARY, PANE_SECONDARY] : [doc.activePane];
  }

  function getActivePaneState() {
    const doc = getActiveDoc();
    return doc?.panes[doc.activePane];
  }

  function getActivePaneNode() {
    return paneNodes.get(getActiveDoc()?.activePane);
  }

  function getActiveTextarea() {
    const node = getActivePaneNode();
    return node?.textarea || null;
  }

  function setActive(id) {
    activeId = id;
    renderApp();
  }

  function renderApp() {
    renderTabs();
    renderWorkspace();
    updateToolbar();
    updateStatus();
  }

  function renderTabs() {
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
    emptyState.hidden = Boolean(doc);
    documentToolbar.hidden = !doc;
  }

  function renderWorkspace() {
    const doc = getActiveDoc();
    paneNodes.clear();
    paneArea.innerHTML = "";
    paneArea.className = `pane-area ${doc?.layoutMode === "split" ? "split" : "single"}`;
    if (!doc) {
      rightInspector.hidden = true;
      return;
    }

    getVisiblePaneIds(doc).forEach((paneId) => {
      const pane = buildPane(doc, paneId);
      paneArea.appendChild(pane.element);
      paneNodes.set(paneId, pane);
    });

    updateAllPanes({ preserveFocus: false });
    renderInspector();
  }

  function buildPane(doc, paneId) {
    const paneState = doc.panes[paneId];
    const element = document.createElement("section");
    element.className = `doc-pane ${doc.activePane === paneId ? "active" : ""}`;
    element.dataset.pane = paneId;

    const body = document.createElement("div");
    body.className = "pane-body";
    element.appendChild(body);

    const node = { element, body, paneId, textarea: null, lineNumbers: null, ghostText: null, preview: null };

    element.addEventListener("pointerdown", () => {
      setActivePane(paneId, false);
    });

    if (paneState.view === VIEW_CODE) {
      const wrap = document.createElement("div");
      wrap.className = `code-editor-wrap pane-code ${showLineNumbers ? "show-lines" : ""}`;
      wrap.style.setProperty("--editor-font-size", `${15 * (editorZoom / 100)}px`);
      if (!lineWrap) wrap.classList.add("no-wrap");

      const lineNumbers = document.createElement("pre");
      lineNumbers.className = "line-numbers";
      lineNumbers.setAttribute("aria-hidden", "true");
      const textarea = document.createElement("textarea");
      textarea.className = "code-editor";
      textarea.spellcheck = false;
      textarea.setAttribute("aria-label", `${paneId === PANE_PRIMARY ? "Left" : "Right"} Markdown code editor`);
      const ghostText = document.createElement("pre");
      ghostText.className = "ghost-text";
      ghostText.setAttribute("aria-hidden", "true");

      wrap.appendChild(lineNumbers);
      wrap.appendChild(textarea);
      wrap.appendChild(ghostText);
      body.appendChild(wrap);

      node.textarea = textarea;
      node.lineNumbers = lineNumbers;
      node.ghostText = ghostText;
      bindTextarea(textarea, paneId);
    } else {
      const preview = document.createElement("div");
      preview.className = "markdown-body pane-preview";
      preview.setAttribute("contenteditable", "false");
      body.appendChild(preview);
      node.preview = preview;
      bindPreview(preview, paneId);
    }

    return node;
  }

  function bindTextarea(textarea, paneId) {
    textarea.addEventListener("focus", () => setActivePane(paneId, true));
    textarea.addEventListener("input", () => handlePaneInput(paneId, textarea));
    textarea.addEventListener("click", () => handlePaneCursor(paneId, textarea));
    textarea.addEventListener("select", () => handlePaneCursor(paneId, textarea));
    textarea.addEventListener("keyup", (event) => {
      handlePaneCursor(paneId, textarea);
      maybeShowSlashMenu(event);
    });
    textarea.addEventListener("scroll", () => handlePaneScroll(paneId, textarea));
    textarea.addEventListener("wheel", (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setEditorZoom(editorZoom + (event.deltaY < 0 ? 10 : -10));
    }, { passive: false });
    textarea.addEventListener("contextmenu", showContextMenu);
    textarea.addEventListener("keydown", handleCodeKeydown);
  }

  function bindPreview(preview, paneId) {
    preview.addEventListener("pointerdown", () => setActivePane(paneId, true));
    preview.addEventListener("scroll", () => handlePreviewScroll(paneId, preview));
    preview.addEventListener("click", (event) => {
      const block = event.target.closest("[data-source-line]");
      if (!block) return;
      const doc = getActiveDoc();
      doc.panes[paneId].sourceLine = Number(block.dataset.sourceLine || 1);
      syncOtherPanesFrom(paneId);
      syncInspectorFromPane(paneId);
    });
  }

  function updateAllPanes({ preserveFocus = true } = {}) {
    const doc = getActiveDoc();
    if (!doc) return;
    const focusedPaneId = preserveFocus ? doc.activePane : null;

    paneNodes.forEach((node, paneId) => {
      const state = doc.panes[paneId];
      if (state.view === VIEW_CODE) {
        updateCodePane(node, state, doc);
      } else {
        updatePreviewPane(node, state, doc);
      }
    });

    if (focusedPaneId) {
      const node = paneNodes.get(focusedPaneId);
      if (node?.textarea && document.activeElement === node.textarea) node.textarea.focus();
    }
    renderInspector();
    updateStatus();
  }

  function updateCodePane(node, state, doc) {
    if (node.textarea.value !== doc.text) node.textarea.value = doc.text;
    const cursor = Math.min(state.cursor, doc.text.length);
    const selectionEnd = Math.min(state.selectionEnd ?? cursor, doc.text.length);
    if (document.activeElement !== node.textarea) {
      node.textarea.selectionStart = cursor;
      node.textarea.selectionEnd = selectionEnd;
    }
    node.textarea.classList.toggle("no-wrap", !lineWrap);
    node.textarea.style.setProperty("--editor-font-size", `${15 * (editorZoom / 100)}px`);
    node.textarea.scrollTop = state.scrollTop || 0;
    if (node.lineNumbers) {
      node.lineNumbers.textContent = showLineNumbers
        ? Array.from({ length: Math.max(1, doc.text.split(/\r?\n/).length) }, (_item, index) => String(index + 1)).join("\n")
        : "";
      node.lineNumbers.scrollTop = node.textarea.scrollTop;
    }
    if (node.ghostText) {
      const showGhost = doc.text.length === 0;
      node.ghostText.textContent = showGhost ? defaultGhostText : "";
      node.ghostText.hidden = !showGhost;
    }
  }

  function updatePreviewPane(node, state, doc) {
    window.MDBasicsDisplay.renderAnchoredMarkdown(node.preview, window.mdb.markdownToHtml, doc.text);
    scrollPreviewToLine(node.preview, state.sourceLine || 1);
  }

  function setActivePane(paneId, focusPane = true) {
    const doc = getActiveDoc();
    if (!doc || doc.activePane === paneId) return;
    doc.activePane = paneId;
    paneNodes.forEach((node, id) => node.element.classList.toggle("active", id === paneId));
    updateToolbar();
    updateStatus();
    if (focusPane) paneNodes.get(paneId)?.textarea?.focus();
  }

  function setLayoutMode(mode) {
    const doc = getActiveDoc();
    if (!doc) return;
    doc.layoutMode = mode;
    if (mode === "single" && !doc.panes[doc.activePane]) doc.activePane = PANE_PRIMARY;
    renderApp();
    setStatus(mode === "split" ? "Split panes active" : "Single pane active");
  }

  function setActivePaneView(view) {
    const doc = getActiveDoc();
    if (!doc) return;
    doc.panes[doc.activePane].view = view;
    renderApp();
    setStatus(view === VIEW_CODE ? "Pane set to Code" : "Pane set to Preview");
  }

  function toggleInspector() {
    inspectorOpen = !inspectorOpen;
    renderInspector();
    updateToolbar();
    setStatus(inspectorOpen ? "Diff inspector open" : "Diff inspector closed");
  }

  function renderInspector() {
    const doc = getActiveDoc();
    rightInspector.hidden = !doc || !inspectorOpen;
    if (!doc || !inspectorOpen) return;
    diffInspectorContent.innerHTML = window.MDBasicsDiff.buildLineDiff(doc.savedText || "", doc.text || "", escapeHtml);
    if (diffFollowLocked) syncInspectorFromPane(doc.activePane);
  }

  function updateToolbar() {
    const doc = getActiveDoc();
    const disabled = !doc;
    [singleLayoutButton, splitLayoutButton, primaryPaneButton, secondaryPaneButton, paneCodeButton,
      panePreviewButton, paneSyncButton, diffInspectorButton, diffFollowButton].forEach((button) => {
      button.disabled = disabled;
    });
    if (!doc) return;
    singleLayoutButton.classList.toggle("active", doc.layoutMode === "single");
    splitLayoutButton.classList.toggle("active", doc.layoutMode === "split");
    paneSelector.hidden = doc.layoutMode !== "split";
    primaryPaneButton.classList.toggle("active", doc.activePane === PANE_PRIMARY);
    secondaryPaneButton.classList.toggle("active", doc.activePane === PANE_SECONDARY);
    paneCodeButton.classList.toggle("active", getActivePaneState()?.view === VIEW_CODE);
    panePreviewButton.classList.toggle("active", getActivePaneState()?.view === VIEW_PREVIEW);
    paneSyncButton.classList.toggle("active", doc.paneSyncLocked);
    diffInspectorButton.classList.toggle("active", inspectorOpen);
    diffFollowButton.classList.toggle("active", diffFollowLocked);
  }

  function updateStatus() {
    const doc = getActiveDoc();
    charCountEl.textContent = `${doc?.text.length || 0} chars`;
    zoomLevelEl.textContent = `${editorZoom}%`;
    if (!doc) {
      cursorPositionEl.textContent = "Ln 1, Col 1";
      return;
    }
    const pane = getActivePaneState();
    const cursor = Math.min(pane?.cursor || 0, doc.text.length);
    const before = doc.text.slice(0, cursor);
    const line = before.split(/\r?\n/).length;
    const lastBreak = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
    const col = cursor - lastBreak;
    cursorPositionEl.textContent = `Ln ${line}, Col ${col}`;
  }

  function handlePaneInput(paneId, textarea) {
    const doc = getActiveDoc();
    if (!doc) return;
    setActivePane(paneId, false);
    const pane = doc.panes[paneId];
    pane.cursor = textarea.selectionStart;
    pane.selectionEnd = textarea.selectionEnd;
    pane.scrollTop = textarea.scrollTop;
    pane.sourceLine = getLineForPosition(textarea.value, textarea.selectionStart);
    setText(textarea.value, true, paneId);
    syncOtherPanesFrom(paneId);
    syncInspectorFromPane(paneId);
  }

  function handlePaneCursor(paneId, textarea) {
    const doc = getActiveDoc();
    if (!doc) return;
    setActivePane(paneId, false);
    const pane = doc.panes[paneId];
    pane.cursor = textarea.selectionStart;
    pane.selectionEnd = textarea.selectionEnd;
    pane.sourceLine = getLineForPosition(textarea.value, textarea.selectionStart);
    updateStatus();
    syncOtherPanesFrom(paneId);
    syncInspectorFromPane(paneId);
  }

  function handlePaneScroll(paneId, textarea) {
    const doc = getActiveDoc();
    if (!doc || paneSyncing) return;
    const pane = doc.panes[paneId];
    pane.scrollTop = textarea.scrollTop;
    pane.sourceLine = estimateLineFromScroll(textarea);
    paneNodes.get(paneId).lineNumbers.scrollTop = textarea.scrollTop;
    syncOtherPanesFrom(paneId);
    syncInspectorFromPane(paneId);
  }

  function handlePreviewScroll(paneId, preview) {
    const doc = getActiveDoc();
    if (!doc || paneSyncing) return;
    const pane = doc.panes[paneId];
    pane.sourceLine = getFirstVisibleSourceLine(preview);
    syncOtherPanesFrom(paneId);
    syncInspectorFromPane(paneId);
  }

  function setText(text, trackHistory = true, sourcePaneId = null) {
    const doc = getActiveDoc();
    if (!doc || doc.text === text) return;
    if (trackHistory && !applyingHistory) {
      doc.undoStack.push(doc.text);
      doc.redoStack = [];
      if (doc.undoStack.length > 200) doc.undoStack.shift();
    }
    doc.text = text;
    doc.dirty = true;
    updateAfterTextChange(sourcePaneId);
  }

  function updateAfterTextChange(sourcePaneId) {
    const doc = getActiveDoc();
    if (!doc) return;
    renderTabs();
    paneNodes.forEach((node, paneId) => {
      if (paneId === sourcePaneId && node.textarea) {
        updateCodePaneChrome(node, doc);
        return;
      }
      const state = doc.panes[paneId];
      if (state.view === VIEW_CODE) updateCodePane(node, state, doc);
      if (state.view === VIEW_PREVIEW) updatePreviewPane(node, state, doc);
    });
    renderInspector();
    updateStatus();
  }

  function updateCodePaneChrome(node, doc) {
    if (node.lineNumbers) {
      node.lineNumbers.textContent = showLineNumbers
        ? Array.from({ length: Math.max(1, doc.text.split(/\r?\n/).length) }, (_item, index) => String(index + 1)).join("\n")
        : "";
      node.lineNumbers.scrollTop = node.textarea.scrollTop;
    }
    if (node.ghostText) {
      node.ghostText.textContent = doc.text.length === 0 ? defaultGhostText : "";
      node.ghostText.hidden = doc.text.length !== 0;
    }
  }

  function undo() {
    const doc = getActiveDoc();
    if (!doc || doc.undoStack.length === 0) return;
    doc.redoStack.push(doc.text);
    applyingHistory = true;
    doc.text = doc.undoStack.pop();
    doc.dirty = true;
    applyingHistory = false;
    updateAfterTextChange();
  }

  function redo() {
    const doc = getActiveDoc();
    if (!doc || doc.redoStack.length === 0) return;
    doc.undoStack.push(doc.text);
    applyingHistory = true;
    doc.text = doc.redoStack.pop();
    doc.dirty = true;
    applyingHistory = false;
    updateAfterTextChange();
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
    const doc = getActiveDoc();
    doc.savedText = file.text;
    doc.dirty = false;
    renderApp();
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
      doc.savedText = doc.text;
      doc.dirty = false;
      renderApp();
      setStatus("Saved");
    } catch (error) {
      console.error(error);
      setStatus(`Save failed: ${error.message || "Unknown error"}`);
    }
  }

  function closeDocument(id) {
    if (!id || documents.length === 0) return;
    if (documents.length === 1) {
      documents = [];
      activeId = null;
      paneArea.innerHTML = "";
      renderApp();
      return;
    }
    const index = documents.findIndex((doc) => doc.id === id);
    documents = documents.filter((doc) => doc.id !== id);
    if (activeId === id) {
      setActive(documents[Math.max(0, index - 1)].id);
    } else {
      renderApp();
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
        ["Single Pane", () => setLayoutMode("single")],
        ["Split Panes", () => setLayoutMode("split")],
        ["Pane Code", () => setActivePaneView(VIEW_CODE)],
        ["Pane Preview", () => setActivePaneView(VIEW_PREVIEW)],
        ["Toggle Diff Inspector", toggleInspector]
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
    updateAllPanes();
  }

  function toggleLineNumbers() {
    closeMenuPanel();
    showLineNumbers = !showLineNumbers;
    updateAllPanes();
  }

  function setEditorZoom(nextZoom) {
    editorZoom = Math.min(180, Math.max(70, nextZoom));
    updateAllPanes();
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

  function getCurrentLineInfo() {
    const editor = getActiveTextarea();
    const value = editor.value;
    const cursor = editor.selectionStart;
    const start = value.lastIndexOf("\n", cursor - 1) + 1;
    const nextBreak = value.indexOf("\n", cursor);
    const end = nextBreak === -1 ? value.length : nextBreak;
    return { start, end, line: value.slice(start, end), cursor };
  }

  function handleMarkdownEnter(event) {
    const editor = getActiveTextarea();
    const info = getCurrentLineInfo();
    const line = info.line;
    const trimmed = line.trim();

    if (isInsideCodeFence(editor.value, info.start)) {
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
    const editor = getActiveTextarea();
    if (!window.MDBasicsTableEditing || !editor) return false;
    const result = window.MDBasicsTableEditing.moveCell(editor.value, editor.selectionStart, event.shiftKey ? -1 : 1);
    if (!result) return false;
    event.preventDefault();
    applyTableResult(result, "Table cell");
    return true;
  }

  function handleTableEnter(event) {
    const editor = getActiveTextarea();
    if (!window.MDBasicsTableEditing || !editor) return false;
    const result = window.MDBasicsTableEditing.insertRow(editor.value, editor.selectionStart, "below");
    if (!result) return false;
    event.preventDefault();
    applyTableResult(result, "Inserted table row");
    return true;
  }

  function exitTable(event) {
    const editor = getActiveTextarea();
    if (!window.MDBasicsTableEditing || !editor) return false;
    const table = window.MDBasicsTableEditing.analyze(editor.value, editor.selectionStart);
    if (!table) return false;
    event.preventDefault();
    const insertionPoint = table.end;
    const suffix = editor.value[insertionPoint] === "\n" ? "\n" : "\n\n";
    editor.value = `${editor.value.slice(0, insertionPoint)}${suffix}${editor.value.slice(insertionPoint)}`;
    setSelection(insertionPoint + suffix.length);
    setText(editor.value, true, getActiveDoc().activePane);
    setStatus("Exited table");
    return true;
  }

  function insertAtSelection(text) {
    const editor = getActiveTextarea();
    const start = editor.selectionStart;
    replaceRange(start, editor.selectionEnd, text);
    setSelection(start + text.length);
  }

  function replaceRange(start, end, text) {
    const editor = getActiveTextarea();
    editor.value = `${editor.value.slice(0, start)}${text}${editor.value.slice(end)}`;
    setText(editor.value, true, getActiveDoc().activePane);
  }

  function setSelection(position) {
    const editor = getActiveTextarea();
    if (!editor) return;
    editor.selectionStart = position;
    editor.selectionEnd = position;
    const pane = getActivePaneState();
    pane.cursor = position;
    pane.selectionEnd = position;
    pane.sourceLine = getLineForPosition(editor.value, position);
  }

  function showContextMenu(event) {
    event.preventDefault();
    const editor = getActiveTextarea();
    if (!editor) return;
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

    contextMenu.hidden = false;
    const rect = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${clamp(event.clientX, 8, window.innerWidth - rect.width - 8)}px`;
    contextMenu.style.top = `${clamp(event.clientY, 8, window.innerHeight - rect.height - 8)}px`;
  }

  function closeContextMenu() {
    contextMenu.hidden = true;
    closeFloatingSubmenus();
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
    document.body.appendChild(submenu);
    contextFloatingMenus.push(submenu);
    wrapper.addEventListener("pointerenter", () => openSubmenu(wrapper, trigger, submenu));
    wrapper.addEventListener("pointerleave", () => scheduleSubmenuClose(wrapper, submenu));
    submenu.addEventListener("pointerenter", cancelSubmenuClose);
    submenu.addEventListener("pointerleave", () => scheduleSubmenuClose(wrapper, submenu));
    contextMenu.appendChild(wrapper);
  }

  function openSubmenu(wrapper, trigger, submenu) {
    cancelSubmenuClose();
    wrapper.classList.add("submenu-open");
    submenu.classList.add("submenu-open");
    submenu.style.visibility = "hidden";
    submenu.style.display = "grid";
    submenu.style.left = "0px";
    submenu.style.top = "0px";

    const triggerRect = trigger.getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();
    const gap = 6;
    const edge = 8;
    const rightSpace = window.innerWidth - triggerRect.right - gap - edge;
    const leftSpace = triggerRect.left - gap - edge;
    const opensLeft = rightSpace < submenuRect.width && leftSpace > rightSpace;
    const maxHeight = Math.max(96, window.innerHeight - (edge * 2));
    const effectiveHeight = Math.min(submenuRect.height, maxHeight);
    const canOpenDown = triggerRect.top + effectiveHeight <= window.innerHeight - edge;
    const canOpenUp = triggerRect.bottom - effectiveHeight >= edge;
    const left = opensLeft
      ? Math.max(edge, triggerRect.left - gap - submenuRect.width)
      : Math.min(window.innerWidth - edge - submenuRect.width, triggerRect.right + gap);
    const top = canOpenDown || !canOpenUp
      ? clamp(triggerRect.top, edge, window.innerHeight - effectiveHeight - edge)
      : clamp(triggerRect.bottom - effectiveHeight, edge, window.innerHeight - effectiveHeight - edge);

    submenu.style.left = `${left}px`;
    submenu.style.top = `${top}px`;
    submenu.style.maxHeight = `${maxHeight}px`;
    submenu.style.overflowY = submenuRect.height > maxHeight ? "auto" : "";
    submenu.style.visibility = "";
  }

  function scheduleSubmenuClose(wrapper, submenu) {
    cancelSubmenuClose();
    submenuCloseTimer = setTimeout(() => closeSubmenu(wrapper, submenu), 120);
  }

  function cancelSubmenuClose() {
    clearTimeout(submenuCloseTimer);
    submenuCloseTimer = null;
  }

  function closeSubmenu(wrapper, submenu) {
    wrapper.classList.remove("submenu-open");
    submenu.classList.remove("submenu-open");
    submenu.style.display = "";
  }

  function closeFloatingSubmenus() {
    cancelSubmenuClose();
    contextFloatingMenus.forEach((submenu) => submenu.remove());
    contextFloatingMenus = [];
  }

  function getTableContextItems() {
    const editor = getActiveTextarea();
    if (!editor || !window.MDBasicsTableEditing?.analyze(editor.value, editor.selectionStart)) return [];
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
    const editor = getActiveTextarea();
    const table = window.MDBasicsTableEditing;
    if (!editor || !table) return;
    const result = table[commandName](editor.value, editor.selectionStart, argument);
    if (!result) {
      setStatus("No table action available");
      return;
    }
    applyTableResult(result, "Updated table");
  }

  function applyTableResult(result, message) {
    const editor = getActiveTextarea();
    editor.value = result.value;
    setSelection(result.cursor);
    setText(editor.value, true, getActiveDoc().activePane);
    editor.focus();
    setStatus(message);
  }

  function wrapCodeSelection(before, after) {
    const editor = getActiveTextarea();
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end);
    const replacement = `${before}${selected}${after}`;
    editor.value = `${editor.value.slice(0, start)}${replacement}${editor.value.slice(end)}`;
    editor.selectionStart = start + before.length;
    editor.selectionEnd = start + before.length + selected.length;
    setText(editor.value, true, getActiveDoc().activePane);
    editor.focus();
  }

  function exitInlineFormatting(event) {
    const editor = getActiveTextarea();
    if (!editor || editor.selectionStart !== editor.selectionEnd) return false;
    const formats = [
      { before: "**", after: "**" },
      { before: "_", after: "_" },
      { before: "<u>", after: "</u>" },
      { before: "`", after: "`" }
    ];
    const cursor = editor.selectionStart;
    const format = formats.find((item) => editor.value.startsWith(item.after, cursor));
    if (!format) return false;

    event.preventDefault();
    const separator = event.key === "Enter" ? "\n" : " ";
    const beforeStart = cursor - format.before.length;
    const isEmptyWrapper = beforeStart >= 0 && editor.value.slice(beforeStart, cursor) === format.before;

    if (isEmptyWrapper) {
      editor.value = `${editor.value.slice(0, beforeStart)}${separator}${editor.value.slice(cursor + format.after.length)}`;
      setSelection(beforeStart + separator.length);
    } else {
      editor.value = `${editor.value.slice(0, cursor + format.after.length)}${separator}${editor.value.slice(cursor + format.after.length)}`;
      setSelection(cursor + format.after.length + separator.length);
    }
    setText(editor.value, true, getActiveDoc().activePane);
    return true;
  }

  function prefixCurrentLine(prefix) {
    const editor = getActiveTextarea();
    const lineStart = editor.value.lastIndexOf("\n", editor.selectionStart - 1) + 1;
    editor.value = `${editor.value.slice(0, lineStart)}${prefix}${editor.value.slice(lineStart)}`;
    editor.selectionStart += prefix.length;
    editor.selectionEnd += prefix.length;
    setText(editor.value, true, getActiveDoc().activePane);
    editor.focus();
  }

  function maybeShowSlashMenu() {
    const editor = getActiveTextarea();
    if (!editor) return;
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    const linePrefix = editor.value.slice(lineStart, start);
    if (!linePrefix.startsWith("/")) {
      slashSuppressed = false;
      hideSlashMenu();
      return;
    }
    if (slashSuppressed) return;
    renderSlashMenu();
    slashMenu.hidden = false;
    positionSlashMenu();
  }

  function positionSlashMenu() {
    const editor = getActiveTextarea();
    if (slashMenu.hidden || !editor) return;
    slashMenu.style.maxHeight = "";
    slashMenu.style.overflowY = "";

    const rect = getTextareaCaretRect(editor);
    const menuRect = slashMenu.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const left = clamp(rect.left, editorRect.left + 8, window.innerWidth - menuRect.width - 8);
    const below = rect.bottom + 6;
    const belowSpace = window.innerHeight - below - 8;
    const aboveSpace = rect.top - editorRect.top - 14;
    const opensAbove = menuRect.height > belowSpace && aboveSpace > belowSpace;
    const availableHeight = Math.max(96, opensAbove ? aboveSpace : belowSpace);
    const top = opensAbove ? Math.max(editorRect.top + 8, rect.top - Math.min(menuRect.height, availableHeight) - 6) : below;

    slashMenu.style.maxHeight = `${availableHeight}px`;
    slashMenu.style.overflowY = menuRect.height > availableHeight ? "auto" : "";
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

  function moveSlashSelection(direction) {
    const commands = getFilteredSlashCommands();
    slashIndex = (slashIndex + direction + commands.length) % commands.length;
    Array.from(slashMenu.children).forEach((child, index) => child.classList.toggle("active", index === slashIndex));
    slashMenu.children[slashIndex]?.scrollIntoView({ block: "nearest" });
    positionSlashMenu();
  }

  function handleSlashKeydown(event) {
    if (slashMenu.hidden) return false;
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      slashSearch += event.key;
      slashIndex = 0;
      renderSlashMenu();
      positionSlashMenu();
      return true;
    }
    if (event.key === "Backspace" && slashSearch) {
      event.preventDefault();
      slashSearch = slashSearch.slice(0, -1);
      slashIndex = 0;
      renderSlashMenu();
      positionSlashMenu();
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

  function hideSlashMenu() {
    slashMenu.hidden = true;
    slashSearch = "";
  }

  function applyLineCommand(command, stripSlash) {
    const editor = getActiveTextarea();
    if (!command || !editor) return;
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = editor.value.indexOf("\n", start);
    const lineEnd = lineEndIndex === -1 ? editor.value.length : lineEndIndex;
    const line = editor.value.slice(lineStart, lineEnd);
    const text = stripBlockMarker(stripSlash ? line.replace(/^\/\w*\s*/, "") : line);

    if (command.marker === "paragraph") {
      editor.value = `${editor.value.slice(0, lineStart)}${text}${editor.value.slice(lineEnd)}`;
      setSelection(lineStart + text.length);
      setText(editor.value, true, getActiveDoc().activePane);
      slashSuppressed = false;
      hideSlashMenu();
      editor.focus();
      return;
    }

    if (command.marker === "table") {
      const table = window.MDBasicsTableEditing.createDefaultTable();
      const prefix = lineStart > 0 && editor.value[lineStart - 1] !== "\n" ? "\n" : "";
      const suffix = lineEnd < editor.value.length && editor.value[lineEnd] !== "\n" ? "\n" : "";
      const replacement = `${prefix}${table.text}${suffix}`;
      editor.value = `${editor.value.slice(0, lineStart)}${replacement}${editor.value.slice(lineEnd)}`;
      setSelection(lineStart + prefix.length + table.cursorOffset);
      setText(editor.value, true, getActiveDoc().activePane);
      slashSuppressed = false;
      hideSlashMenu();
      editor.focus();
      setStatus("Inserted table");
      return;
    }

    const marker = command.marker === "numbered" ? `${getNextListNumberBefore(lineStart)}. ` : command.marker;
    const replacement = marker.includes("\n") ? marker : `${marker}${text}`;
    editor.value = `${editor.value.slice(0, lineStart)}${replacement}${editor.value.slice(lineEnd)}`;
    setSelection(lineStart + (command.cursorOffset ?? replacement.length));
    setText(editor.value, true, getActiveDoc().activePane);
    slashSuppressed = false;
    hideSlashMenu();
    editor.focus();
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
    const editor = getActiveTextarea();
    const lines = editor.value.slice(0, position).split(/\r?\n/).reverse();
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\.\s/);
      if (match) return Number(match[1]) + 1;
      if (line.trim() !== "") break;
    }
    return 1;
  }

  function syncOtherPanesFrom(sourcePaneId) {
    const doc = getActiveDoc();
    if (!doc || !doc.paneSyncLocked || doc.layoutMode !== "split" || paneSyncing) return;
    const sourceLine = doc.panes[sourcePaneId].sourceLine || 1;
    paneSyncing = true;
    getVisiblePaneIds(doc).forEach((paneId) => {
      if (paneId === sourcePaneId) return;
      doc.panes[paneId].sourceLine = sourceLine;
      const node = paneNodes.get(paneId);
      if (!node) return;
      if (doc.panes[paneId].view === VIEW_CODE && node.textarea) {
        node.textarea.scrollTop = estimateScrollTopForLine(node.textarea, sourceLine);
        doc.panes[paneId].scrollTop = node.textarea.scrollTop;
      }
      if (doc.panes[paneId].view === VIEW_PREVIEW && node.preview) {
        scrollPreviewToLine(node.preview, sourceLine);
      }
    });
    paneSyncing = false;
  }

  function syncInspectorFromPane(paneId) {
    const doc = getActiveDoc();
    if (!doc || !inspectorOpen || !diffFollowLocked) return;
    const sourceLine = doc.panes[paneId]?.sourceLine || 1;
    const target = diffInspectorContent.querySelector(`[data-source-line="${sourceLine}"]`)
      || findNearestSourceElement(diffInspectorContent, sourceLine);
    if (target) diffInspectorContent.scrollTop = target.offsetTop - diffInspectorContent.clientHeight * 0.2;
  }

  function scrollPreviewToLine(preview, line) {
    const target = preview.querySelector(`[data-source-line="${line}"]`) || findNearestSourceElement(preview, line);
    if (target) preview.scrollTop = target.offsetTop - preview.clientHeight * 0.2;
  }

  function findNearestSourceElement(container, line) {
    const elements = Array.from(container.querySelectorAll("[data-source-line]"));
    if (!elements.length) return null;
    return elements.reduce((best, item) => {
      const delta = Math.abs(Number(item.dataset.sourceLine) - line);
      const bestDelta = Math.abs(Number(best.dataset.sourceLine) - line);
      return delta < bestDelta ? item : best;
    }, elements[0]);
  }

  function getFirstVisibleSourceLine(container) {
    const elements = Array.from(container.querySelectorAll("[data-source-line]"));
    const current = elements.find((item) => item.offsetTop + item.offsetHeight > container.scrollTop + 8);
    return Number((current || elements[0])?.dataset.sourceLine || 1);
  }

  function getLineForPosition(value, position) {
    return value.slice(0, position).split(/\r?\n/).length;
  }

  function estimateLineFromScroll(textarea) {
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight || "24");
    return Math.max(1, Math.floor(textarea.scrollTop / lineHeight) + 1);
  }

  function estimateScrollTopForLine(textarea, line) {
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight || "24");
    return Math.max(0, (line - 1) * lineHeight);
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
    return { left: Math.min(left, textareaRect.right - 220), top, bottom: top + parseFloat(style.lineHeight || "20") };
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
      menuSearchTimer = setTimeout(() => { menuSearch = ""; }, 800);
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

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function bindEvents() {
    document.getElementById("newTabButton").addEventListener("click", () => createDocument());
    emptyOpenButton.addEventListener("click", openFiles);
    singleLayoutButton.addEventListener("click", () => setLayoutMode("single"));
    splitLayoutButton.addEventListener("click", () => setLayoutMode("split"));
    primaryPaneButton.addEventListener("click", () => setActivePane(PANE_PRIMARY));
    secondaryPaneButton.addEventListener("click", () => setActivePane(PANE_SECONDARY));
    paneCodeButton.addEventListener("click", () => setActivePaneView(VIEW_CODE));
    panePreviewButton.addEventListener("click", () => setActivePaneView(VIEW_PREVIEW));
    paneSyncButton.addEventListener("click", () => {
      const doc = getActiveDoc();
      if (!doc) return;
      doc.paneSyncLocked = !doc.paneSyncLocked;
      updateToolbar();
    });
    diffInspectorButton.addEventListener("click", toggleInspector);
    diffFollowButton.addEventListener("click", () => {
      diffFollowLocked = !diffFollowLocked;
      updateToolbar();
      renderInspector();
    });
    closeInspectorButton.addEventListener("click", () => {
      inspectorOpen = false;
      renderInspector();
      updateToolbar();
    });

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
      if (!contextMenu.contains(event.target) && !contextFloatingMenus.some((menu) => menu.contains(event.target))) closeContextMenu();
      if (!slashMenu.contains(event.target) && event.target !== getActiveTextarea()) hideSlashMenu();
    });
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
