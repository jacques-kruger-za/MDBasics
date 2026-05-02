(function () {
  const tabsEl = document.getElementById("tabs");
  const filePathEl = document.getElementById("filePath");
  const statusMessage = document.getElementById("statusMessage");
  const cursorPositionEl = document.getElementById("cursorPosition");
  const charCountEl = document.getElementById("charCount");
  const zoomLevelEl = document.getElementById("zoomLevel");
  const emptyState = document.getElementById("emptyState");
  const emptyOpenButton = document.getElementById("emptyOpenButton");
  const emptyNewButton = document.getElementById("emptyNewButton");
  const workspaceSurface = document.getElementById("workspaceSurface");
  const appMenuButton = document.getElementById("appMenuButton");
  const activityToggleButton = document.getElementById("activityToggleButton");
  const shareButton = document.getElementById("shareButton");
  const menuPanel = document.getElementById("menuPanel");
  const contextMenu = document.getElementById("contextMenu");
  const slashMenu = document.getElementById("slashMenu");
  const paneArea = document.getElementById("paneArea");
  const rightInspector = document.getElementById("rightInspector");
  const diffInspectorContent = document.getElementById("diffInspectorContent");
  const topbarInspectorButton = document.getElementById("topbarInspectorButton");

  const inspectorInfoButton = document.getElementById("inspectorInfoButton");
  const inspectorDiffButton = document.getElementById("inspectorDiffButton");
  const diffChangedOnlyButton = document.getElementById("diffChangedOnlyButton");
  const closeInspectorButton = document.getElementById("closeInspectorButton");
  const inspectorResizeHandle = document.getElementById("inspectorResizeHandle");
  const activityPane = document.getElementById("activityPane");
  const activityPaneTitle = document.getElementById("activityPaneTitle");
  const activityPaneContent = document.getElementById("activityPaneContent");
  const activityPaneCloseButton = document.getElementById("activityPaneCloseButton");
  const activityPaneDockButton = document.getElementById("activityPaneDockButton");
  const activityResizeHandle = document.getElementById("activityResizeHandle");
  const settingsOverlay = document.getElementById("settingsOverlay");
  const settingsOverlayContent = document.getElementById("settingsOverlayContent");
  const settingsOverlayCloseButton = document.getElementById("settingsOverlayCloseButton");

  inspectorInfoButton.dataset.inspectorMode = "info";
  inspectorDiffButton.dataset.inspectorMode = "diff";

  const PANE_PRIMARY = "primary";
  const PANE_SECONDARY = "secondary";
  const VIEW_CODE = "code";
  const VIEW_PREVIEW = "preview";

  let activeId = null;
  let documents = [];
  let applyingHistory = false;
  let lineWrap = true;
  let showLineNumbers = false;
  let activeMenuName = null;
  let menuSearch = "";
  let menuSearchTimer = null;
  let slashIndex = 0;
  let slashSuppressed = false;
  let slashSearch = "";
  let contextFloatingMenus = [];
  let submenuCloseTimer = null;
  let inspectorOpen = false;
  let inspectorMode = "info";
  let diffChangedOnly = true;
  let paneRefreshing = false;
  let activityOpen = false;
  let activityRailVisible = false;
  let activeActivity = "outline";
  let activityPinned = false;
  let activityResize = null;
  let inspectorResize = null;
  let paneResize = null;
  let searchQuery = "";
  let replaceQuery = "";
  let searchOptions = { caseSensitive: false, wholeWord: false, regex: false };
  let searchMatches = [];
  let activeSearchIndex = 0;
  let recentFiles = [];
  let inlineSpaceExitCandidate = null;
  let appSettings = {
    theme: "dark",
    accentColor: "#68d8c1",
    glass: false,
    editorFont: "Cascadia Code",
    previewFont: "Segoe UI",
    showFormattingToolbar: false,
    showLineNumbers: false,
    lineWrap: true,
    scrollSyncAllowed: false,
    activityRailVisible: false,
    activityPaneWidth: 280,
    inspectorWidth: 360,
    lastActivityTool: "outline",
    recentFiles: [],
    fileStates: {}
  };

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
  boot();

  async function boot() {
    await loadAppSettings();
    createDocument({ text: "" });
  }

  async function loadAppSettings() {
    try {
      const loaded = await window.mdb.loadSettings();
      appSettings = { ...appSettings, ...loaded };
      recentFiles = Array.isArray(appSettings.recentFiles) ? appSettings.recentFiles : [];
      lineWrap = appSettings.lineWrap !== false;
      showLineNumbers = Boolean(appSettings.showLineNumbers);
      activityRailVisible = Boolean(appSettings.activityRailVisible);
      activeActivity = appSettings.lastActivityTool || "outline";
      applySettingsToDom();
    } catch (error) {
      console.error(error);
      setStatus("Settings unavailable");
    }
  }

  function applySettingsToDom() {
    const lightTheme = ["light", "github-light", "catppuccin-latte"].includes(appSettings.theme);
    document.body.dataset.theme = appSettings.theme || "dark";
    document.body.classList.toggle("light", lightTheme);
    document.body.classList.toggle("glass", Boolean(appSettings.glass));
    document.body.classList.toggle("activity-pinned", activityRailVisible && activityOpen && activityPinned);
    document.documentElement.style.setProperty("--accent", appSettings.accentColor || "#68d8c1");
    document.documentElement.style.setProperty("--activity-pane-width", `${clamp(Number(appSettings.activityPaneWidth) || 280, 220, 520)}px`);
    document.documentElement.style.setProperty("--inspector-width", `${clamp(Number(appSettings.inspectorWidth) || 360, 280, 620)}px`);
    document.documentElement.style.setProperty("--editor-font", `"${appSettings.editorFont || "Cascadia Code"}", "SFMono-Regular", Consolas, monospace`);
    document.documentElement.style.setProperty("--preview-font", `"${appSettings.previewFont || "Segoe UI"}", Inter, ui-sans-serif, system-ui, sans-serif`);
    document.body.classList.toggle("activity-visible", activityRailVisible);
    activityToggleButton.classList.toggle("active", activityRailVisible);
    window.mdb.setTitlebarTheme(lightTheme ? "light" : "dark");
  }

  function queueSaveSettings() {
    appSettings.lineWrap = lineWrap;
    appSettings.showLineNumbers = showLineNumbers;
    appSettings.lastActivityTool = activeActivity;
    appSettings.activityRailVisible = activityRailVisible;
    appSettings.inspectorWidth = Number(appSettings.inspectorWidth) || 360;
    appSettings.recentFiles = recentFiles;
    window.mdb.saveSettings(appSettings).catch((error) => console.error(error));
  }

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
      splitRatio: 0.5,
      paneSyncLocked: false,
      syncSourcePane: PANE_PRIMARY,
      zoom: 100,
      panes: {
        primary: createPaneState(VIEW_CODE),
        secondary: createPaneState(VIEW_PREVIEW)
      }
    };
    documents.push(doc);
    applyPersistedFileState(doc);
    setActive(doc.id);
  }

  function applyPersistedFileState(doc) {
    const state = doc.filePath ? appSettings.fileStates?.[doc.filePath] : null;
    if (!state) return;
    doc.zoom = state.zoom || doc.zoom;
    doc.layoutMode = state.layoutMode || doc.layoutMode;
    doc.splitRatio = typeof state.splitRatio === "number" ? state.splitRatio : doc.splitRatio;
    doc.activePane = state.activePane || doc.activePane;
    doc.panes.primary.view = state.panes?.primary?.view || doc.panes.primary.view;
    doc.panes.secondary.view = state.panes?.secondary?.view || doc.panes.secondary.view;
    inspectorOpen = Boolean(state.inspectorOpen);
    inspectorMode = state.inspectorMode === "diff" ? "diff" : "info";
  }

  function persistFileState(doc = getActiveDoc()) {
    if (!doc?.filePath) return;
    appSettings.fileStates = appSettings.fileStates || {};
    appSettings.fileStates[doc.filePath] = {
      zoom: doc.zoom,
      layoutMode: doc.layoutMode,
      splitRatio: doc.splitRatio,
      activePane: doc.activePane,
      panes: {
        primary: { view: doc.panes.primary.view },
        secondary: { view: doc.panes.secondary.view }
      },
      inspectorOpen,
      inspectorMode
    };
    queueSaveSettings();
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
      tab.className = `tab ${item.id === activeId ? "active" : ""} ${item.dirty ? "dirty" : ""}`;
      tab.role = "tab";
      tab.title = item.filePath || item.title;
      tab.innerHTML = `
        <button class="tab-title" type="button">${escapeHtml(item.title)}</button>
        <span class="tab-dirty-dot" aria-hidden="true"></span>
        <button class="tab-close" type="button" aria-label="Close ${escapeHtml(item.title)}">×</button>`;
      tab.addEventListener("click", (event) => {
        if (event.target.classList.contains("tab-close")) {
          closeDocument(item.id);
        } else {
          setActive(item.id);
        }
      });
      tabsEl.appendChild(tab);
    });
    const addTab = document.createElement("button");
    addTab.className = "new-tab inline-new-tab";
    addTab.type = "button";
    addTab.title = "New document";
    addTab.setAttribute("aria-label", "New document");
    addTab.textContent = "+";
    addTab.addEventListener("click", () => createDocument());
    tabsEl.appendChild(addTab);

    filePathEl.textContent = "";
    statusMessage.textContent = "";
    emptyState.hidden = Boolean(doc);
  }

  function renderWorkspace() {
    const doc = getActiveDoc();
    paneNodes.clear();
    paneArea.innerHTML = "";
    updatePaneAreaMode(doc);
    if (!doc) {
      rightInspector.hidden = true;
      workspaceSurface.hidden = true;
      return;
    }
    workspaceSurface.hidden = false;

    getVisiblePaneIds(doc).forEach((paneId) => {
      const pane = buildPane(doc, paneId);
      paneArea.appendChild(pane.element);
      paneNodes.set(paneId, pane);
    });
    if (doc.layoutMode === "split") {
      const divider = document.createElement("div");
      divider.className = "pane-resize-handle";
      divider.setAttribute("aria-hidden", "true");
      divider.addEventListener("pointerdown", startPaneResize);
      paneArea.appendChild(divider);
    }
    updateAllPanes({ preserveFocus: false });
    renderInspector();
    renderActivityPane();
  }

  function updatePaneAreaMode(doc = getActiveDoc()) {
    paneArea.className = `pane-area ${doc?.layoutMode === "split" ? "split" : "single"} free`;
    if (doc?.layoutMode === "split") {
      const ratio = clamp(doc.splitRatio || 0.5, 0.25, 0.75);
      paneArea.style.setProperty("--split-left", `${ratio * 100}%`);
      paneArea.style.setProperty("--split-right", `${(1 - ratio) * 100}%`);
    } else {
      paneArea.style.removeProperty("--split-left");
      paneArea.style.removeProperty("--split-right");
    }
  }

  function buildPane(doc, paneId) {
    const paneState = doc.panes[paneId];
    const element = document.createElement("section");
    element.className = `doc-pane ${doc.activePane === paneId ? "active" : ""}`;
    element.dataset.pane = paneId;

    const header = document.createElement("div");
    header.className = "pane-header";
    const formattingToolbar = appSettings.showFormattingToolbar && paneState.view === VIEW_CODE ? buildPaneFormattingToolbar() : "";
    header.innerHTML = `
      <span class="pane-active-dot" title="Active pane" aria-label="Active pane"></span>
      <div class="pane-menu" role="group" aria-label="${paneId === PANE_PRIMARY ? "Left" : "Right"} pane controls">
        <div class="pane-view-toggle segmented-control" role="group" aria-label="${paneId === PANE_PRIMARY ? "Left" : "Right"} pane view">
          <button class="pane-view-button ${paneState.view === VIEW_CODE ? "active" : ""}" data-pane-view="code" title="Code" aria-label="Code">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 9-4 3 4 3M16 9l4 3-4 3M13 5l-2 14"/></svg>
          </button>
          <button class="pane-view-button ${paneState.view === VIEW_PREVIEW ? "active" : ""}" data-pane-view="preview" title="Preview" aria-label="Preview">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <button class="pane-menu-button ${doc.layoutMode === "split" ? "active" : ""}" data-pane-action="split" title="Split panes" aria-label="Split panes">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="7" height="14" rx="2"/><rect x="13" y="5" width="7" height="14" rx="2"/></svg>
        </button>
        <button class="pane-menu-button parked" data-pane-action="sync" title="Scroll interlock parked" aria-label="Scroll interlock parked" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        </button>
        ${formattingToolbar}
      </div>`;
    header.querySelectorAll("[data-pane-view]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        setPaneView(paneId, button.dataset.paneView);
      });
    });
    header.querySelector("[data-pane-action='split']")?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      setActivePane(paneId, false);
      toggleSplitLayout();
    });
    header.querySelector("[data-pane-action='sync']")?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      setStatus("Scroll sync is parked for the foundation redesign");
    });
    header.querySelectorAll("[data-format-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        runPaneFormatAction(paneId, button.dataset.formatAction);
      });
    });
    element.appendChild(header);

    const body = document.createElement("div");
    body.className = "pane-body";
    element.appendChild(body);

    const node = { element, body, paneId, wrap: null, textarea: null, lineNumbers: null, ghostText: null, preview: null };

    element.addEventListener("pointerdown", () => {
      setActivePane(paneId, false);
    });

    if (paneState.view === VIEW_CODE) {
      const wrap = document.createElement("div");
      wrap.className = `code-editor-wrap pane-code codemirror-wrap ${showLineNumbers ? "show-lines" : ""}`;
      if (!lineWrap) wrap.classList.add("no-wrap");

      body.appendChild(wrap);

      node.wrap = wrap;
      const editor = window.MDBasicsCodeMirror.createMarkdownEditor({
        parent: wrap,
        value: doc.text,
        lineWrapping: lineWrap,
        lineNumbers: showLineNumbers,
        fontSize: 15 * (getDocZoom(doc) / 100),
        onFocus: () => setActivePane(paneId, true),
        onChange: () => handlePaneInput(paneId, editor),
        onCursor: () => handlePaneCursor(paneId, editor),
        onScroll: () => handlePaneScroll(paneId, editor),
        onWheel: (event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          setEditorZoom(getDocZoom() + (event.deltaY < 0 ? 10 : -10));
        },
        onContextMenu: showContextMenu,
        onKeydown: handleCodeKeydown,
        onKeyup: (event) => {
          handlePaneCursor(paneId, editor);
          maybeShowSlashMenu(event);
        }
      });
      editor.dom.setAttribute("aria-label", `${paneId === PANE_PRIMARY ? "Left" : "Right"} Markdown code editor`);
      node.textarea = editor;
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

  function buildPaneFormattingToolbar() {
    const buttons = [
      ["heading1", "H1", "Heading 1"],
      ["heading2", "H2", "Heading 2"],
      ["bullet", "UL", "Bullet list"],
      ["numbered", "1.", "Numbered list"],
      ["task", "Task", "Task item"],
      ["bold", "B", "Bold"],
      ["italic", "I", "Italic"],
      ["underline", "U", "Underline"],
      ["strike", "S", "Strikethrough"],
      ["link", "Link", "Link"],
      ["table", "Table", "Table"]
    ];
    return `<div class="pane-format-toolbar" role="group" aria-label="Formatting">${buttons
      .map(([action, label, title]) => `<button type="button" data-format-action="${action}" title="${title}" aria-label="${title}">${label}</button>`)
      .join("")}</div>`;
  }

  function runPaneFormatAction(paneId, action) {
    const doc = getActiveDoc();
    if (!doc || doc.panes[paneId]?.view !== VIEW_CODE) return;
    setActivePane(paneId, false);
    const commandByAction = {
      heading1: slashCommands[0],
      heading2: slashCommands[1],
      bullet: slashCommands[4],
      numbered: slashCommands[5],
      task: slashCommands[6],
      table: slashCommands.find((command) => command.marker === "table")
    };
    if (commandByAction[action]) {
      applyLineCommand(commandByAction[action], false);
      return;
    }
    const wrappers = {
      bold: ["**", "**"],
      italic: ["_", "_"],
      underline: ["<u>", "</u>"],
      strike: ["~~", "~~"],
      link: ["[", "](url)"]
    };
    if (wrappers[action]) wrapCodeSelection(...wrappers[action]);
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
      setEditorZoom(getDocZoom() + (event.deltaY < 0 ? 10 : -10));
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
    });
  }

  function updateAllPanes({ preserveFocus = true } = {}) {
    const doc = getActiveDoc();
    if (!doc) return;
    const focusedPaneId = preserveFocus ? doc.activePane : null;

    paneRefreshing = true;
    try {
      paneNodes.forEach((node, paneId) => {
        const state = doc.panes[paneId];
        if (state.view === VIEW_CODE) {
          updateCodePane(node, state, doc);
        } else {
          updatePreviewPane(node, state, doc);
        }
      });
    } finally {
      paneRefreshing = false;
    }

    if (focusedPaneId) {
      const node = paneNodes.get(focusedPaneId);
      if (node?.textarea?.hasFocus?.()) node.textarea.focus();
    }
    renderInspector();
    updateStatus();
  }

  function updateCodePane(node, state, doc) {
    const previousScrollTop = node.textarea.scrollTop;
    const previousScrollLeft = node.textarea.scrollLeft;
    const previousSelectionStart = node.textarea.selectionStart;
    const previousSelectionEnd = node.textarea.selectionEnd;
    const wasFocused = Boolean(node.textarea.hasFocus?.());
    if (node.textarea.value !== doc.text) node.textarea.value = doc.text;
    const cursor = Math.min(state.cursor, doc.text.length);
    const selectionEnd = Math.min(state.selectionEnd ?? cursor, doc.text.length);
    if (!wasFocused) {
      node.textarea.selectionStart = Math.min(previousSelectionStart ?? cursor, doc.text.length);
      node.textarea.selectionEnd = Math.min(previousSelectionEnd ?? selectionEnd, doc.text.length);
    }
    node.textarea.setLineWrapping?.(lineWrap);
    node.textarea.setLineNumbers?.(showLineNumbers);
    node.wrap?.classList.toggle("show-lines", showLineNumbers);
    node.wrap?.classList.toggle("no-wrap", !lineWrap);
    node.wrap?.style.setProperty("--editor-font-size", `${15 * (getDocZoom(doc) / 100)}px`);
    node.textarea.setFontSize?.(15 * (getDocZoom(doc) / 100));
    node.textarea.scrollTop = wasFocused ? previousScrollTop : state.scrollTop ?? previousScrollTop ?? 0;
    node.textarea.scrollLeft = previousScrollLeft || 0;
    updateLineNumbers(node, doc);
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
    persistFileState(doc);
    setStatus(mode === "split" ? "Split panes active" : "Single pane active");
  }

  function toggleSplitLayout() {
    const doc = getActiveDoc();
    if (!doc) return;
    setLayoutMode(doc.layoutMode === "split" ? "single" : "split");
  }

  function setActivePaneView(view) {
    const doc = getActiveDoc();
    if (!doc) return;
    setPaneView(doc.activePane, view);
  }

  function setPaneView(paneId, view) {
    const doc = getActiveDoc();
    if (!doc || !doc.panes[paneId]) return;
    doc.panes[paneId].view = view;
    doc.activePane = paneId;
    doc.syncSourcePane = paneId;
    renderApp();
    persistFileState(doc);
    setStatus(view === VIEW_CODE ? "Pane set to Code" : "Pane set to Preview");
  }

  function toggleInspector() {
    inspectorOpen = !inspectorOpen;
    renderInspector();
    updateToolbar();
    persistFileState();
    setStatus(inspectorOpen ? "Inspector open" : "Inspector closed");
  }

  function setInspectorMode(mode) {
    inspectorMode = mode;
    inspectorOpen = true;
    renderInspector();
    updateToolbar();
    persistFileState();
  }

  function renderInspector() {
    const doc = getActiveDoc();
    rightInspector.hidden = !doc || !inspectorOpen;
    if (!doc || !inspectorOpen) return;
    updateInspectorButtons();
    if (inspectorMode === "info") {
      diffInspectorContent.className = "inspector-content";
      diffInspectorContent.innerHTML = buildFileStats(doc);
      return;
    }
    diffInspectorContent.className = "inspector-content diff-view";
    diffInspectorContent.innerHTML = window.MDBasicsDiff.buildLineDiff(doc.savedText || "", doc.text || "", escapeHtml, {
      changesOnly: diffChangedOnly
    });
  }

  function updateInspectorButtons() {
    [inspectorInfoButton, inspectorDiffButton].forEach((button) => {
      if (!button) return;
      button.classList.toggle("active", button.dataset.inspectorMode === inspectorMode);
    });
    if (diffChangedOnlyButton) {
      diffChangedOnlyButton.hidden = inspectorMode !== "diff";
      diffChangedOnlyButton.classList.toggle("active", diffChangedOnly);
    }
  }

  function buildFileStats(doc) {
    const stats = getDocumentStats(doc.text);
    return `
      <div class="inspector-panel">
        <h2>${escapeHtml(doc.title || "Untitled")}</h2>
        <dl>
          <dt>Status</dt><dd>${doc.dirty ? "Unsaved changes" : "Saved"}</dd>
          <dt>Characters</dt><dd>${stats.characters}</dd>
          <dt>Words</dt><dd>${stats.words}</dd>
          <dt>Lines</dt><dd>${stats.lines}</dd>
          <dt>Paragraphs</dt><dd>${stats.paragraphs}</dd>
          <dt>Headings</dt><dd>${stats.headings}</dd>
          <dt>Tasks</dt><dd>${stats.tasksDone} / ${stats.tasksTotal}</dd>
          <dt>Tables</dt><dd>${stats.tables}</dd>
          <dt>Links</dt><dd>${stats.links}</dd>
          <dt>Top words</dt><dd>${stats.topWords.length ? stats.topWords.map((item) => `${escapeHtml(item.word)} (${item.count})`).join(", ") : "None"}</dd>
          <dt>Path</dt><dd>${doc.filePath ? escapeHtml(doc.filePath) : "Untitled document"}</dd>
        </dl>
      </div>`;
  }

  function getDocumentStats(text) {
    const lines = text.length ? text.split(/\r?\n/) : [];
    const words = text.match(/[A-Za-z0-9']+/g) || [];
    const paragraphs = text.split(/\n\s*\n/).filter((block) => block.trim() && !/^\s*#{1,6}\s/m.test(block)).length;
    const headings = lines.filter((line) => /^(#{1,6})\s+/.test(line)).length;
    const tasks = lines.filter((line) => /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line));
    const tables = countMarkdownTables(lines);
    const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
    const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "you", "your", "are", "was", "were", "have", "has", "but", "not", "can", "will", "into", "its", "a", "an", "of", "to", "in", "on", "is", "as", "by", "or", "be"]);
    const frequencies = new Map();
    words.forEach((word) => {
      const normalized = word.toLowerCase();
      if (normalized.length < 3 || stopWords.has(normalized)) return;
      frequencies.set(normalized, (frequencies.get(normalized) || 0) + 1);
    });
    return {
      characters: text.length,
      words: words.length,
      lines: lines.length,
      paragraphs,
      headings,
      tasksTotal: tasks.length,
      tasksDone: tasks.filter((line) => /\[[xX]\]/.test(line)).length,
      tables,
      links,
      topWords: Array.from(frequencies, ([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
        .slice(0, 5)
    };
  }

  function countMarkdownTables(lines) {
    let count = 0;
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (/\|/.test(lines[index]) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) count += 1;
    }
    return count;
  }

  function buildFileIndex(doc) {
    const headings = doc.text.split(/\r?\n/).map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return null;
      return { level: match[1].length, text: match[2].replace(/\s+#+\s*$/, ""), line: index + 1 };
    }).filter(Boolean);

    if (!headings.length) {
      return `<div class="inspector-empty">No headings in this document.</div>`;
    }

    return `<ol class="file-index">${headings.map((heading) => `
      <li style="--level:${heading.level}">
        <button type="button" data-index-line="${heading.line}">
          <span>${escapeHtml(heading.text)}</span>
          <small>Ln ${heading.line}</small>
        </button>
      </li>`).join("")}</ol>`;
  }

  function openActivity(tool, pinned = false) {
    if (tool === "settings") {
      openSettingsOverlay();
      return;
    }
    activityRailVisible = true;
    activeActivity = tool;
    activityOpen = true;
    activityPinned = pinned || activityPinned;
    activityPane.hidden = false;
    renderActivityPane();
    applySettingsToDom();
    queueSaveSettings();
    if (tool === "search") {
      requestAnimationFrame(() => activityPaneContent.querySelector(".search-input")?.focus());
    }
  }

  function closeActivityPane() {
    activityOpen = false;
    activityPinned = false;
    activityPane.hidden = true;
    applySettingsToDom();
    document.querySelectorAll(".activity-button").forEach((button) => button.classList.remove("active"));
  }

  function toggleActivityRail() {
    activityRailVisible = !activityRailVisible;
    if (!activityRailVisible) {
      activityPane.hidden = true;
      activityPane.classList.remove("pinned");
      document.body.classList.remove("activity-pinned");
    } else if (activityOpen) {
      renderActivityPane();
    }
    applySettingsToDom();
    queueSaveSettings();
  }

  function openSettingsOverlay() {
    settingsOverlay.hidden = false;
    renderSettingsOverlay();
  }

  function closeSettingsOverlay() {
    settingsOverlay.hidden = true;
  }

  function renderActivityPane() {
    if (!activityOpen) {
      activityPane.hidden = true;
      activityPane.classList.remove("pinned");
      document.body.classList.remove("activity-pinned");
      return;
    }
    activityPane.hidden = false;
    activityPane.classList.toggle("pinned", activityPinned);
    activityPaneDockButton.classList.toggle("active", activityPinned);
    activityPaneDockButton.title = activityPinned ? "Undock activity pane" : "Dock activity pane";
    activityPaneDockButton.setAttribute("aria-label", activityPinned ? "Undock activity pane" : "Dock activity pane");
    document.body.classList.toggle("activity-pinned", activityRailVisible && activityOpen && activityPinned);
    document.querySelectorAll(".activity-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.activity === activeActivity);
    });
    const titles = { outline: "Outline", search: "Search", recents: "Recents", settings: "Settings" };
    activityPaneTitle.textContent = titles[activeActivity] || "Activity";
    if (activeActivity === "outline") renderOutlineActivity();
    if (activeActivity === "search") renderSearchActivity();
    if (activeActivity === "recents") renderRecentsActivity();
    if (activeActivity === "settings") renderSettingsActivity();
  }

  function renderOutlineActivity() {
    const doc = getActiveDoc();
    if (!doc) {
      activityPaneContent.innerHTML = `<div class="activity-empty">No document open.</div>`;
      return;
    }
    const headings = doc.text.split(/\r?\n/).map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return null;
      return { level: match[1].length, text: match[2].replace(/\s+#+\s*$/, ""), line: index + 1 };
    }).filter(Boolean);
    if (!headings.length) {
      activityPaneContent.innerHTML = `<div class="activity-empty">No headings in this document.</div>`;
      return;
    }
    activityPaneContent.innerHTML = `<ol class="activity-list">${headings.map((heading) => `
      <li style="--level:${heading.level}">
        <button type="button" data-activity-line="${heading.line}">
          <span>${escapeHtml(heading.text)}</span>
          <small>Ln ${heading.line}</small>
        </button>
      </li>`).join("")}</ol>`;
  }

  function renderSearchActivity() {
    refreshSearchMatches();
    activityPaneContent.innerHTML = `
      <div class="search-panel">
        <div class="search-row">
          <input class="search-input" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search" />
          <button type="button" data-search-action="previous" title="Previous match">Prev</button>
          <button type="button" data-search-action="next" title="Next match">Next</button>
        </div>
        <div class="replace-row">
          <input class="replace-input" type="text" value="${escapeHtml(replaceQuery)}" placeholder="Replace" />
          <button type="button" data-search-action="replace-current" title="Replace current">Replace</button>
          <button type="button" data-search-action="replace-all" title="Replace all">All</button>
        </div>
        <div class="search-options">
          <button type="button" class="${searchOptions.caseSensitive ? "active" : ""}" data-search-toggle="caseSensitive">Aa</button>
          <button type="button" class="${searchOptions.wholeWord ? "active" : ""}" data-search-toggle="wholeWord">Word</button>
          <button type="button" class="${searchOptions.regex ? "active" : ""}" data-search-toggle="regex">.*</button>
        </div>
        <div class="search-count">${searchQuery ? `${searchMatches.length} match${searchMatches.length === 1 ? "" : "es"}` : "Active document search"}</div>
        <ol class="activity-list">${searchMatches.map((match, index) => `
          <li>
            <button type="button" class="${index === activeSearchIndex ? "active" : ""}" data-search-index="${index}">
              <span>${escapeHtml(getLineSnippet(getActiveDoc()?.text || "", match.start))}</span>
              <small>Ln ${getLineForPosition(getActiveDoc()?.text || "", match.start)}</small>
            </button>
          </li>`).join("")}</ol>
      </div>`;
    activityPaneContent.querySelector(".search-input")?.setSelectionRange(searchQuery.length, searchQuery.length);
  }

  function renderRecentsActivity() {
    if (!recentFiles.length) {
      activityPaneContent.innerHTML = `<div class="activity-empty">No recent files yet.</div>`;
      return;
    }
    activityPaneContent.innerHTML = `<div class="activity-list">${recentFiles.map((filePath) => `
      <button class="recent-file-button" type="button" data-recent-file="${escapeHtml(filePath)}">
        <span>${escapeHtml(filePath.split(/[\\/]/).pop())}</span>
        <small>${escapeHtml(filePath)}</small>
      </button>`).join("")}</div>`;
  }

  function renderSettingsActivity() {
    activityPaneContent.innerHTML = buildSettingsPanel();
  }

  function renderSettingsOverlay() {
    settingsOverlayContent.innerHTML = buildSettingsPanel();
  }

  function buildSettingsPanel() {
    return `
      <div class="settings-panel">
        <section class="settings-section">
          <h3>Appearance</h3>
          <label class="settings-row">Theme
            <select class="settings-select" data-setting="theme">
              <option value="dark" ${appSettings.theme === "dark" ? "selected" : ""}>Cappuccino Dark</option>
              <option value="light" ${appSettings.theme === "light" ? "selected" : ""}>Cappuccino Light</option>
              <option value="vscode-dark" ${appSettings.theme === "vscode-dark" ? "selected" : ""}>VS Code Dark+</option>
              <option value="github-light" ${appSettings.theme === "github-light" ? "selected" : ""}>GitHub Light</option>
              <option value="catppuccin-mocha" ${appSettings.theme === "catppuccin-mocha" ? "selected" : ""}>Catppuccin Mocha</option>
              <option value="catppuccin-latte" ${appSettings.theme === "catppuccin-latte" ? "selected" : ""}>Catppuccin Latte</option>
            </select>
          </label>
          <label class="settings-row">Accent
            <input type="color" data-setting="accentColor" value="${escapeHtml(appSettings.accentColor || "#68d8c1")}" />
          </label>
        </section>
        <section class="settings-section">
          <h3>Editor</h3>
          ${buildSettingsToggle("showFormattingToolbar", "Show formatting toolbar", appSettings.showFormattingToolbar)}
          ${buildSettingsToggle("showLineNumbers", "Show line numbers", showLineNumbers)}
          ${buildSettingsToggle("lineWrap", "Line wrap", lineWrap)}
          ${buildSettingsToggle("scrollSyncAllowed", "Allow scroll sync", false, true)}
        </section>
      </div>`;
  }

  function buildSettingsToggle(setting, label, checked, disabled = false) {
    return `<label class="settings-row"><span>${escapeHtml(label)}</span><input type="checkbox" data-setting="${setting}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} /></label>`;
  }

  function refreshSearchMatches() {
    searchMatches = [];
    const doc = getActiveDoc();
    if (!doc || !searchQuery) {
      activeSearchIndex = 0;
      return;
    }
    try {
      const flags = searchOptions.caseSensitive ? "g" : "gi";
      const source = searchOptions.regex ? searchQuery : escapeRegExp(searchQuery);
      const bounded = searchOptions.wholeWord ? `\\b${source}\\b` : source;
      const regex = new RegExp(bounded, flags);
      let match;
      while ((match = regex.exec(doc.text)) !== null) {
        searchMatches.push({ start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) regex.lastIndex += 1;
      }
    } catch (_error) {
      searchMatches = [];
    }
    activeSearchIndex = clamp(activeSearchIndex, 0, Math.max(0, searchMatches.length - 1));
  }

  function jumpToSearchMatch(index) {
    if (!searchMatches.length) return;
    activeSearchIndex = (index + searchMatches.length) % searchMatches.length;
    const match = searchMatches[activeSearchIndex];
    jumpActivePaneToLine(getLineForPosition(getActiveDoc().text, match.start));
    const editor = getActiveTextarea();
    if (editor) {
      editor.selectionStart = match.start;
      editor.selectionEnd = match.end;
      editor.focus();
      handlePaneCursor(getActiveDoc().activePane, editor);
    }
    renderSearchActivity();
  }

  function replaceCurrentMatch() {
    refreshSearchMatches();
    if (!searchMatches.length) return;
    const match = searchMatches[activeSearchIndex];
    replaceTextRange(match.start, match.end, replaceQuery);
    refreshSearchMatches();
    renderSearchActivity();
  }

  function replaceAllMatches() {
    refreshSearchMatches();
    if (!searchMatches.length) return;
    const doc = getActiveDoc();
    let nextText = doc.text;
    [...searchMatches].reverse().forEach((match) => {
      nextText = `${nextText.slice(0, match.start)}${replaceQuery}${nextText.slice(match.end)}`;
    });
    setText(nextText, true, doc.activePane);
    refreshSearchMatches();
    renderSearchActivity();
    setStatus("Replaced matches");
  }

  function replaceTextRange(start, end, text) {
    const doc = getActiveDoc();
    if (!doc) return;
    const nextText = `${doc.text.slice(0, start)}${text}${doc.text.slice(end)}`;
    setText(nextText, true, doc.activePane);
    const editor = getActiveTextarea();
    if (editor) {
      editor.value = nextText;
      editor.selectionStart = start;
      editor.selectionEnd = start + text.length;
      editor.focus();
    }
  }

  function getLineSnippet(text, position) {
    const start = text.lastIndexOf("\n", position - 1) + 1;
    const endIndex = text.indexOf("\n", position);
    const end = endIndex === -1 ? text.length : endIndex;
    return text.slice(start, end).trim() || "(blank line)";
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function updateToolbar() {
    const doc = getActiveDoc();
    const disabled = !doc;
    [shareButton, topbarInspectorButton].forEach((button) => {
      button.disabled = disabled;
    });
    if (!doc) return;
    topbarInspectorButton.classList.toggle("active", inspectorOpen);
    updateInspectorButtons();
  }

  function updateStatus() {
    const doc = getActiveDoc();
    if (!doc) {
      cursorPositionEl.textContent = "";
      charCountEl.textContent = "";
      zoomLevelEl.textContent = "";
      filePathEl.textContent = "";
      statusMessage.textContent = "";
      return;
    }
    zoomLevelEl.textContent = `${getDocZoom(doc)}%`;
    const pane = getActivePaneState();
    const cursor = Math.min(pane?.cursor || 0, doc.text.length);
    const selectionEnd = Math.min(pane?.selectionEnd ?? cursor, doc.text.length);
    const before = doc.text.slice(0, cursor);
    const line = before.split(/\r?\n/).length;
    const lastBreak = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
    const col = cursor - lastBreak;
    cursorPositionEl.textContent = `Ln ${line}, Col ${col}`;
    const selectedChars = Math.abs(selectionEnd - cursor);
    charCountEl.textContent = selectedChars > 0
      ? `${selectedChars} of ${doc.text.length} chars`
      : `${doc.text.length} chars`;
  }

  function handlePaneInput(paneId, textarea) {
    const doc = getActiveDoc();
    if (!doc) return;
    setActivePane(paneId, false);
    const pane = doc.panes[paneId];
    pane.cursor = textarea.selectionStart;
    pane.selectionEnd = textarea.selectionEnd;
    pane.scrollTop = textarea.scrollTop;
    pane.sourceLine = getTopVisibleBlockLine(doc.text, getTopVisibleCodeLine(textarea));
    setText(textarea.value, true, paneId);
    renderActivityPane();
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
  }

  function handlePaneScroll(paneId, textarea) {
    const doc = getActiveDoc();
    if (!doc) return;
    if (paneRefreshing) {
      const node = paneNodes.get(paneId);
      if (node?.lineNumbers) node.lineNumbers.scrollTop = textarea.scrollTop;
      return;
    }
    const pane = doc.panes[paneId];
    doc.syncSourcePane = paneId;
    pane.scrollTop = textarea.scrollTop;
    pane.sourceLine = getTopVisibleBlockLine(doc.text, getTopVisibleCodeLine(textarea));
    const node = paneNodes.get(paneId);
    if (node?.lineNumbers) node.lineNumbers.scrollTop = textarea.scrollTop;
  }

  function handlePreviewScroll(paneId, preview) {
    const doc = getActiveDoc();
    if (!doc || paneRefreshing) return;
    const pane = doc.panes[paneId];
    doc.syncSourcePane = paneId;
    pane.sourceLine = getFirstVisibleSourceLine(preview);
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
    paneRefreshing = true;
    try {
      paneNodes.forEach((node, paneId) => {
        if (paneId === sourcePaneId && node.textarea) {
          updateCodePaneChrome(node, doc);
          return;
        }
        const state = doc.panes[paneId];
        if (state.view === VIEW_CODE) updateCodePane(node, state, doc);
        if (state.view === VIEW_PREVIEW) updatePreviewPane(node, state, doc);
      });
    } finally {
      paneRefreshing = false;
    }
    renderInspector();
    renderActivityPane();
    updateStatus();
  }

  function updateCodePaneChrome(node, doc) {
    node.wrap?.classList.toggle("show-lines", showLineNumbers);
    node.wrap?.classList.toggle("no-wrap", !lineWrap);
    node.wrap?.style.setProperty("--editor-font-size", `${15 * (getDocZoom(doc) / 100)}px`);
    updateLineNumbers(node, doc);
    if (node.ghostText) {
      node.ghostText.textContent = doc.text.length === 0 ? defaultGhostText : "";
      node.ghostText.hidden = doc.text.length !== 0;
    }
  }

  function updateLineNumbers(node, doc) {
    if (!node?.lineNumbers || !node.textarea) return;
    if (!showLineNumbers) {
      node.lineNumbers.textContent = "";
      return;
    }
    const lineCount = Math.max(1, doc.text.split(/\r?\n/).length);
    node.lineNumbers.textContent = Array.from({ length: lineCount }, (_item, index) => String(index + 1)).join("\n");
    node.lineNumbers.scrollTop = node.textarea.scrollTop;
    requestAnimationFrame(() => {
      node.lineNumbers.scrollTop = node.textarea.scrollTop;
    });
  }

  function refreshVisibleLineNumbers() {
    const doc = getActiveDoc();
    if (!doc) return;
    paneNodes.forEach((node) => updateLineNumbers(node, doc));
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
    addRecentFile(file.filePath);
    const doc = getActiveDoc();
    doc.savedText = file.text;
    doc.dirty = false;
    renderApp();
  }

  async function saveDocument(doc, saveAs = false) {
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
        return false;
      }
      doc.filePath = saved.filePath;
      doc.title = saved.filePath.split(/[\\/]/).pop();
      doc.savedText = doc.text;
      doc.dirty = false;
      addRecentFile(saved.filePath);
      persistFileState(doc);
      renderApp();
      setStatus("Saved");
      return true;
    } catch (error) {
      console.error(error);
      setStatus(`Save failed: ${error.message || "Unknown error"}`);
    }
    return false;
  }

  async function saveActive(saveAs = false) {
    await saveDocument(getActiveDoc(), saveAs);
  }

  function addRecentFile(filePath) {
    if (!filePath) return;
    recentFiles = [filePath, ...recentFiles.filter((item) => item !== filePath)].slice(0, 20);
    appSettings.recentFiles = recentFiles;
    window.mdb.addRecentFile(filePath).catch((error) => console.error(error));
    renderActivityPane();
  }

  async function closeDocument(id) {
    if (!id || documents.length === 0) return;
    const closingDoc = documents.find((doc) => doc.id === id);
    if (!closingDoc) return;
    if (closingDoc.dirty) {
      const choice = await window.mdb.confirmCloseUnsaved({ title: closingDoc.title });
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await saveDocument(closingDoc, false);
        if (!saved) return;
      }
    }
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
    const menus = getMenus();
    menuPanel.innerHTML = "";
    menus[menuName].forEach((entry) => {
      if (entry.separator) {
        const separator = document.createElement("div");
        separator.className = "menu-separator";
        menuPanel.appendChild(separator);
        return;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.innerHTML = `<span>${escapeHtml(entry.label)}</span>${entry.items ? `<span class="menu-shortcut">›</span>` : entry.shortcut ? `<span class="menu-shortcut">${escapeHtml(entry.shortcut)}</span>` : ""}`;
      item.dataset.menuLabel = entry.label.toLowerCase();
      item.disabled = Boolean(entry.disabled);
      item.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (entry.items) return;
        if (entry.disabled) return;
        entry.action();
        closeMenuPanel();
      });
      if (entry.items) {
        item.addEventListener("pointerenter", () => openMenuSubmenu(item, entry.items));
      }
      menuPanel.appendChild(item);
    });

    const rect = anchor.getBoundingClientRect();
    menuPanel.style.left = `${rect.left}px`;
    menuPanel.style.top = `${rect.bottom + 2}px`;
    menuPanel.hidden = false;
    activeMenuName = menuName;
    menuSearch = "";
  }

  function openMenuSubmenu(trigger, entries) {
    closeFloatingSubmenus();
    const submenu = document.createElement("div");
    submenu.className = "menu-panel submenu-panel submenu-open";
    entries.forEach((entry) => {
      const item = document.createElement("button");
      item.type = "button";
      item.innerHTML = `<span>${escapeHtml(entry.label)}</span>${entry.shortcut ? `<span class="menu-shortcut">${escapeHtml(entry.shortcut)}</span>` : ""}`;
      item.disabled = Boolean(entry.disabled);
      item.dataset.menuLabel = entry.label.toLowerCase();
      item.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (entry.disabled) return;
        entry.action();
        closeFloatingSubmenus();
        closeMenuPanel();
      });
      submenu.appendChild(item);
    });
    document.body.appendChild(submenu);
    contextFloatingMenus.push(submenu);
    const rect = trigger.getBoundingClientRect();
    submenu.style.display = "grid";
    submenu.style.left = `${rect.right + 4}px`;
    submenu.style.top = `${rect.top}px`;
  }

  function getMenus() {
    const doc = getActiveDoc();
    const hasDoc = Boolean(doc);
    return {
      app: [
        { label: "File", items: [
          { label: "New", shortcut: "Ctrl+N", action: () => createDocument() },
          { label: "Open", shortcut: "Ctrl+O", action: openFiles },
          { label: "Save", shortcut: "Ctrl+S", action: () => saveActive(false), disabled: !hasDoc },
          { label: "Save As", shortcut: "Ctrl+Shift+S", action: () => saveActive(true), disabled: !hasDoc },
          { label: "Close Tab", shortcut: "Ctrl+W", action: () => closeDocument(activeId), disabled: !hasDoc }
        ] },
        { label: "Export", items: [
          { label: "PDF", action: exportPdf, disabled: !hasDoc },
          { label: "DOCX", action: exportWord, disabled: !hasDoc },
          { label: "HTML", action: exportHtml, disabled: !hasDoc },
          { label: "Print", shortcut: "Ctrl+P", action: printDocument, disabled: !hasDoc }
        ] },
        { label: "Edit", items: [
          { label: "Undo", shortcut: "Ctrl+Z", action: undo, disabled: !hasDoc },
          { label: "Redo", shortcut: "Ctrl+Y", action: redo, disabled: !hasDoc },
          { label: "Cut", shortcut: "Ctrl+X", action: () => document.execCommand("cut"), disabled: !hasDoc },
          { label: "Copy", shortcut: "Ctrl+C", action: () => document.execCommand("copy"), disabled: !hasDoc },
          { label: "Paste", shortcut: "Ctrl+V", action: () => document.execCommand("paste"), disabled: !hasDoc },
          { label: "Select All", shortcut: "Ctrl+A", action: () => getActiveTextarea()?.select(), disabled: !hasDoc }
        ] },
        { label: "View", items: [
          { label: "Single Pane", action: () => setLayoutMode("single"), disabled: !hasDoc },
          { label: "Split Pane", action: () => setLayoutMode("split"), disabled: !hasDoc },
          { label: "Code View", action: () => setActivePaneView(VIEW_CODE), disabled: !hasDoc },
          { label: "Preview View", action: () => setActivePaneView(VIEW_PREVIEW), disabled: !hasDoc },
          { label: "Inspector", action: toggleInspector, disabled: !hasDoc },
          { label: "Activity Bar", action: toggleActivityRail }
        ] },
        { separator: true },
        { label: "Settings", action: () => openActivity("settings", true) }
      ],
      share: [
        { label: "Export PDF", action: exportPdf, disabled: !hasDoc },
        { label: "Export DOCX", action: exportWord, disabled: !hasDoc },
        { label: "Export HTML", action: exportHtml, disabled: !hasDoc },
        { label: "Print", shortcut: "Ctrl+P", action: printDocument, disabled: !hasDoc }
      ]
    };
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
    const doc = getActiveDoc();
    if (!doc) return;
    doc.zoom = Math.min(180, Math.max(70, nextZoom));
    updateAllPanes();
  }

  function getDocZoom(doc = getActiveDoc()) {
    return doc?.zoom || 100;
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
      return true;
    }
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === "enter" && exitTable(event)) return true;
      if (event.key.startsWith("Arrow") && handleTableArrowNavigation(event)) return true;
      if (key === "b") {
        event.preventDefault();
        wrapCodeSelection("**", "**");
        return true;
      }
      if (key === "i") {
        event.preventDefault();
        wrapCodeSelection("_", "_");
        return true;
      }
      if (key === "u") {
        event.preventDefault();
        wrapCodeSelection("<u>", "</u>");
        return true;
      }
    }
    if (handleInlineSpaceKey(event)) return true;
    if (event.key !== " ") inlineSpaceExitCandidate = null;
    if (event.key === "`" && handleInlineBacktickKey(event)) return true;
    if ((event.key === "Enter" || event.key === "Tab" || isInlineExitCharacter(event.key)) && exitInlineFormatting(event)) return true;
    if (event.key === "Tab" && handleListTab(event)) return true;
    if (event.key === "Tab" && handleTableTab(event)) return true;
    if (event.key === "Enter" && handleTableEnter(event)) return true;
    if (event.key === "Enter" && handleCodeFenceEnter(event)) return true;
    if (event.key === "Enter" && handleMarkdownEnter(event)) return true;
    if (event.key === "Enter" && getActiveTextarea()?.continueMarkdownMarkup?.()) {
      event.preventDefault();
      return true;
    }
    if (event.key === "Backspace" && getActiveTextarea()?.deleteMarkdownMarkupBackward?.()) {
      event.preventDefault();
      return true;
    }
    if (event.key === "Tab") {
      insertCodeTab(event);
      return true;
    }
    return false;
  }

  function isInlineExitCharacter(key) {
    return ["`", "\"", "'", "]", ")", "}", ">"].includes(key);
  }

  function handleInlineSpaceKey(event) {
    if (event.key !== " ") return false;
    const editor = getActiveTextarea();
    if (!editor || editor.selectionStart !== editor.selectionEnd) {
      inlineSpaceExitCandidate = null;
      return false;
    }
    const cursor = editor.selectionStart;
    const marker = getInlineClosingMarkerAtCursor(editor.value, cursor);
    if (!marker) {
      inlineSpaceExitCandidate = null;
      return false;
    }
    if (
      inlineSpaceExitCandidate
      && inlineSpaceExitCandidate.cursor === cursor
      && inlineSpaceExitCandidate.marker === marker
      && editor.value.slice(cursor - 1, cursor) === " "
    ) {
      inlineSpaceExitCandidate = null;
      event.preventDefault();
      return exitInlineFormatting(event);
    }
    inlineSpaceExitCandidate = { cursor: cursor + 1, marker };
    return false;
  }

  function getInlineClosingMarkerAtCursor(value, cursor) {
    const markers = ["</u>", "**", "~~", "_", "`", "\"", "'", "]", ")", "}", ">"];
    return markers.find((marker) => value.slice(cursor, cursor + marker.length) === marker) || null;
  }

  function handleInlineBacktickKey(event) {
    const editor = getActiveTextarea();
    if (!editor) return false;
    const cursor = editor.selectionStart;
    const selectionEnd = editor.selectionEnd;
    if (cursor !== selectionEnd) {
      event.preventDefault();
      wrapCodeSelection("`", "`");
      return true;
    }
    if (editor.value.slice(cursor, cursor + 1) === "`") {
      event.preventDefault();
      return exitInlineFormatting(event);
    }

    const info = getCurrentLineInfo();
    const beforeOnLine = editor.value.slice(info.start, cursor);
    const afterOnLine = editor.value.slice(cursor, info.end);
    const couldBecomeFence = /^\s*`{0,2}$/.test(beforeOnLine) && afterOnLine.trim() === "";
    if (couldBecomeFence) return false;

    event.preventDefault();
    replaceRange(cursor, cursor, "``", cursor + 1);
    return true;
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
        exitEmptyContinuationLine(info.start, info.end, "Exited list");
        return true;
      }
      insertAtSelection(`\n${task[1]}- [ ] `);
      return true;
    }

    const numbered = line.match(/^(\s*)(\d+)\.\s(.*)$/);
    if (numbered) {
      event.preventDefault();
      if (numbered[3].trim() === "") {
        exitEmptyContinuationLine(info.start, info.end, "Exited list");
        return true;
      }
      insertAtSelection(`\n${numbered[1]}${Number(numbered[2]) + 1}. `);
      return true;
    }

    const bullet = line.match(/^(\s*)([-*+])\s(.*)$/);
    if (bullet) {
      event.preventDefault();
      if (bullet[3].trim() === "") {
        exitEmptyContinuationLine(info.start, info.end, "Exited list");
        return true;
      }
      insertAtSelection(`\n${bullet[1]}${bullet[2]} `);
      return true;
    }

    const quote = line.match(/^(\s*>\s?)(.*)$/);
    if (quote) {
      event.preventDefault();
      if (quote[2].trim() === "") {
        exitEmptyContinuationLine(info.start, info.end, "Exited quote");
        return true;
      }
      insertAtSelection(`\n${quote[1]}`);
      return true;
    }

    if (/^#{1,6}\s+\S/.test(trimmed) && info.cursor >= info.end) {
      event.preventDefault();
      const result = normalizeBlankLineAfterInsertion(editor.value, info.end);
      replaceRange(result.from, result.to, result.insert, result.cursor);
      setStatus("Exited heading");
      return true;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed) && info.cursor >= info.end) {
      event.preventDefault();
      const result = normalizeBlankLineAfterInsertion(editor.value, info.end);
      replaceRange(result.from, result.to, result.insert, result.cursor);
      setStatus("Exited divider");
      return true;
    }

    if (/^```/.test(trimmed)) {
      event.preventDefault();
      const nextLineStart = info.end + 1;
      const nextLineEndIndex = editor.value.indexOf("\n", nextLineStart);
      const nextLineEnd = nextLineEndIndex === -1 ? editor.value.length : nextLineEndIndex;
      const nextLine = editor.value.slice(nextLineStart, nextLineEnd);
      if (/^\s*```/.test(nextLine)) {
        insertAtSelection("\n");
        return true;
      }
      replaceRange(info.end, info.end, "\n\n```", info.end + 1);
      return true;
    }

    return false;
  }

  function handleCodeFenceEnter(event) {
    const editor = getActiveTextarea();
    if (!editor) return false;
    const info = getCurrentLineInfo();
    const trimmed = info.line.trim();
    const isAlreadyInsideFence = isInsideCodeFence(editor.value, info.start);
    if (/^```[\w-]*\s*$/.test(trimmed) && !isAlreadyInsideFence) {
      event.preventDefault();
      const nextLineStart = info.end + 1;
      const nextLineEndIndex = editor.value.indexOf("\n", nextLineStart);
      const nextLineEnd = nextLineEndIndex === -1 ? editor.value.length : nextLineEndIndex;
      const nextLine = editor.value.slice(nextLineStart, nextLineEnd);
      if (/^\s*```/.test(nextLine)) {
        insertAtSelection("\n");
        return true;
      }
      replaceRange(info.end, info.end, "\n\n```", info.end + 1);
      return true;
    }
    if (!isAlreadyInsideFence) return false;
    const nextLineStart = info.end + 1;
    const nextLineEndIndex = editor.value.indexOf("\n", nextLineStart);
    const nextLineEnd = nextLineEndIndex === -1 ? editor.value.length : nextLineEndIndex;
    const nextLine = editor.value.slice(nextLineStart, nextLineEnd);
    const exitsAtClosingFence = info.line.trim() === "" && /^\s*```/.test(nextLine);

    event.preventDefault();
    if (exitsAtClosingFence) {
      const result = normalizeBlankLineAfterReplacement(editor.value, info.start, nextLineEnd, nextLine);
      replaceRange(result.from, result.to, result.insert, result.cursor);
      setStatus("Exited code block");
      return true;
    }

    insertAtSelection("\n");
    return true;
  }

  function exitEmptyContinuationLine(start, end, message) {
    const editor = getActiveTextarea();
    if (!editor) return;
    const result = normalizeBlankLineAfterReplacement(editor.value, start, end, "");
    replaceRange(result.from, result.to, result.insert, result.cursor);
    setStatus(message);
  }

  function normalizeBlankLineAfterReplacement(value, from, to, insert) {
    let tailStart = to;
    while (value[tailStart] === "\n") tailStart += 1;
    const insertText = insert ? `${insert}\n\n` : "\n";
    return {
      from,
      to: tailStart,
      insert: insertText,
      cursor: from + insertText.length
    };
  }

  function normalizeBlankLineAfterInsertion(value, position) {
    let tailStart = position;
    while (value[tailStart] === "\n") tailStart += 1;
    return {
      from: position,
      to: tailStart,
      insert: "\n\n",
      cursor: position + 2
    };
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

  function handleListTab(event) {
    const editor = getActiveTextarea();
    if (!editor) return false;
    const info = getCurrentLineInfo();
    if (!/^(\s*)([-*+]|\d+\.|-\s\[[ xX]\])\s/.test(info.line)) return false;
    event.preventDefault();
    const isOrdered = /^\s*\d+\.\s/.test(info.line);
    if (event.shiftKey) {
      const remove = info.line.startsWith("  ") ? 2 : info.line.startsWith("\t") ? 1 : 0;
      if (!remove) return true;
      const nextValue = `${editor.value.slice(0, info.start)}${editor.value.slice(info.start + remove)}`;
      const nextCursor = Math.max(info.start, info.cursor - remove);
      applyListTabResult(nextValue, nextCursor, isOrdered);
      return true;
    }
    const nextValue = `${editor.value.slice(0, info.start)}  ${editor.value.slice(info.start)}`;
    applyListTabResult(nextValue, info.cursor + 2, isOrdered);
    return true;
  }

  function applyListTabResult(value, cursor, shouldRenumber) {
    const result = shouldRenumber ? normalizeOrderedListNumbers(value, cursor) : { value, cursor };
    const editor = getActiveTextarea();
    replaceRange(0, editor.value.length, result.value, result.cursor);
  }

  function normalizeOrderedListNumbers(value, cursor) {
    const lines = value.split("\n");
    const lineStarts = [];
    let position = 0;
    for (const line of lines) {
      lineStarts.push(position);
      position += line.length + 1;
    }

    const lineIndex = getLineIndexAtPosition(lineStarts, lines, cursor);
    if (!isMarkdownListLine(lines[lineIndex])) return { value, cursor };

    let start = lineIndex;
    while (start > 0 && isMarkdownListLine(lines[start - 1])) start -= 1;
    let end = lineIndex;
    while (end < lines.length - 1 && isMarkdownListLine(lines[end + 1])) end += 1;

    const counters = new Map();
    let nextCursor = cursor;
    const normalized = [...lines];
    for (let index = start; index <= end; index += 1) {
      const match = normalized[index].match(/^(\s*)(\d+)(\.\s.*)$/);
      if (!match) continue;
      const depth = getIndentWidth(match[1]);
      for (const key of [...counters.keys()]) {
        if (key > depth) counters.delete(key);
      }
      const nextNumber = (counters.get(depth) || 0) + 1;
      counters.set(depth, nextNumber);

      const oldNumber = match[2];
      const newNumber = String(nextNumber);
      if (oldNumber === newNumber) continue;

      const numberStart = lineStarts[index] + match[1].length;
      const numberEnd = numberStart + oldNumber.length;
      const diff = newNumber.length - oldNumber.length;
      normalized[index] = `${match[1]}${newNumber}${match[3]}`;
      if (cursor > numberEnd) nextCursor += diff;
    }

    return { value: normalized.join("\n"), cursor: nextCursor };
  }

  function getLineIndexAtPosition(lineStarts, lines, cursor) {
    for (let index = lineStarts.length - 1; index >= 0; index -= 1) {
      if (cursor >= lineStarts[index]) return index;
    }
    return Math.min(lines.length - 1, 0);
  }

  function isMarkdownListLine(line) {
    return /^(\s*)([-*+]|\d+\.|-\s\[[ xX]\])\s/.test(line);
  }

  function getIndentWidth(indent) {
    return indent.replace(/\t/g, "  ").length;
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

  function handleTableArrowNavigation(event) {
    const editor = getActiveTextarea();
    const table = window.MDBasicsTableEditing?.analyze(editor?.value || "", editor?.selectionStart || 0);
    if (!editor || !table) return false;
    event.preventDefault();

    let targetRow = table.dataRowIndex;
    let targetCol = table.colIndex;
    if (event.key === "ArrowRight") targetCol += 1;
    if (event.key === "ArrowLeft") targetCol -= 1;
    if (event.key === "ArrowDown") targetRow += 1;
    if (event.key === "ArrowUp") targetRow -= 1;

    targetRow = clamp(targetRow, 0, table.rows.length - 1);
    targetCol = clamp(targetCol, 0, table.columnCount - 1);
    const result = window.MDBasicsTableEditing.moveToCell?.(editor.value, editor.selectionStart, targetRow, targetCol);
    if (result) {
      setSelection(result.cursor);
      editor.focus();
      setStatus("Table cell");
    }
    return true;
  }

  function handleTableEnter(event) {
    const editor = getActiveTextarea();
    if (!window.MDBasicsTableEditing || !editor) return false;
    const table = window.MDBasicsTableEditing.analyze(editor.value, editor.selectionStart);
    if (table && isEmptyTableDataRow(table)) return exitTable(event);
    const result = window.MDBasicsTableEditing.insertRow(editor.value, editor.selectionStart, "below");
    if (!result) return false;
    event.preventDefault();
    applyTableResult(result, "Inserted table row");
    return true;
  }

  function isEmptyTableDataRow(table) {
    const row = table.rows?.[table.dataRowIndex];
    return Array.isArray(row) && row.every((cell) => String(cell || "").trim() === "");
  }

  function exitTable(event) {
    const editor = getActiveTextarea();
    if (!window.MDBasicsTableEditing || !editor) return false;
    const table = window.MDBasicsTableEditing.analyze(editor.value, editor.selectionStart);
    if (!table) return false;
    event.preventDefault();
    const result = normalizeBlankLineAfterInsertion(editor.value, table.end);
    replaceRange(result.from, result.to, result.insert, result.cursor);
    setText(editor.value, true, getActiveDoc().activePane);
    setStatus("Exited table");
    return true;
  }

  function insertAtSelection(text) {
    const editor = getActiveTextarea();
    if (editor?.insertText) {
      editor.insertText(text);
      return;
    }
    const start = editor.selectionStart;
    replaceRange(start, editor.selectionEnd, text);
    setSelection(start + text.length);
  }

  function replaceRange(start, end, text, cursor) {
    const editor = getActiveTextarea();
    if (editor?.replaceRange) {
      editor.replaceRange(start, end, text, cursor);
      return;
    }
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
    editor.exitInlineFormatting?.("Tab");
    closeMenuPanel();
    closeContextMenu();
    contextMenu.innerHTML = "";
    const hasSelection = editor.selectionStart !== editor.selectionEnd;
    if (hasSelection) {
      addContextButton("Cut", () => document.execCommand("cut"));
      addContextButton("Copy", () => document.execCommand("copy"));
      addContextButton("Paste", () => document.execCommand("paste"));
      addContextButton("Select All", () => editor.select());
      addContextSeparator();
      addContextSubmenu("Formatting", [
        ["Bold", () => wrapCodeSelection("**", "**")],
        ["Italic", () => wrapCodeSelection("_", "_")],
        ["Underline", () => wrapCodeSelection("<u>", "</u>")],
        ["Code", () => wrapCodeSelection("`", "`")]
      ]);
    } else {
      addContextButton("Paste", () => document.execCommand("paste"));
      addContextButton("Select All", () => editor.select());
      addContextSeparator();
      addContextSubmenu("Insert", slashCommands.map((command) => [command.label, () => applyLineCommand(command, false)]));
    }

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
    if (editor?.replaceRange) {
      editor.replaceRange(0, editor.value.length, result.value, result.cursor);
    } else {
      editor.value = result.value;
    }
    setSelection(result.cursor);
    setText(editor.value, true, getActiveDoc().activePane);
    editor.focus();
    setStatus(message);
  }

  function wrapCodeSelection(before, after) {
    const editor = getActiveTextarea();
    if (!editor) return;
    if (editor.wrapInline) {
      editor.wrapInline(before, after);
      return;
    }
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
    if (editor?.exitInlineFormatting?.(event.key)) {
      event.preventDefault();
      return true;
    }
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
    const table = command.marker === "table" && window.MDBasicsTableEditing ? window.MDBasicsTableEditing.createDefaultTable() : null;
    if (editor.applyLineCommand?.(command, { stripSlash, table })) {
      slashSuppressed = false;
      hideSlashMenu();
      editor.focus();
      if (command.marker === "table") setStatus("Inserted table");
      return;
    }
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

  function scrollPreviewToLine(preview, line) {
    const target = preview.querySelector(`[data-source-line="${line}"]`) || findNearestSourceElement(preview, line);
    if (target) preview.scrollTop = target.offsetTop;
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

  function getTopVisibleCodeLine(textarea) {
    if (textarea?.topVisibleLine) return textarea.topVisibleLine();
    const lineHeight = getTextareaLineHeight(textarea);
    return Math.max(1, Math.floor(textarea.scrollTop / lineHeight) + 1);
  }

  function getTopVisibleBlockLine(markdown, line) {
    return getBlockForLine(markdown, line).sourceLine;
  }

  function getBlockForLine(markdown, line) {
    const blocks = window.MDBasicsDisplay.getMarkdownBlocks(markdown);
    if (!blocks.length) return { sourceLine: 1, text: "" };
    let previousBlock = blocks[0];
    blocks.forEach((block) => {
      if (block.sourceLine <= line) previousBlock = block;
    });
    return previousBlock || blocks[0] || { sourceLine: 1, text: "" };
  }

  function getLineForPosition(value, position) {
    return value.slice(0, position).split(/\r?\n/).length;
  }

  function estimateScrollTopForLine(textarea, line) {
    return (Math.max(1, line) - 1) * getTextareaLineHeight(textarea);
  }

  function estimateScrollTopForAnchor(doc, textarea, anchor) {
    const block = getBlockForLine(doc.text, anchor.sourceLine);
    const blockLineCount = Math.max(1, block.text.split(/\r?\n/).length);
    const targetLine = block.sourceLine + Math.round(blockLineCount * anchor.ratio);
    return estimateScrollTopForLine(textarea, targetLine);
  }

  function jumpActivePaneToLine(line) {
    const doc = getActiveDoc();
    if (!doc) return;
    const node = getActivePaneNode();
    const targetLine = Math.max(1, line);
    if (node?.textarea) {
      node.textarea.scrollTop = estimateScrollTopForLine(node.textarea, targetLine);
      const offset = getOffsetForLine(doc.text, targetLine);
      node.textarea.selectionStart = offset;
      node.textarea.selectionEnd = offset;
      node.textarea.focus();
      handlePaneCursor(doc.activePane, node.textarea);
      handlePaneScroll(doc.activePane, node.textarea);
      return;
    }
    if (node?.preview) {
      scrollPreviewToLine(node.preview, targetLine);
      handlePreviewScroll(doc.activePane, node.preview);
    }
  }

  function getOffsetForLine(text, line) {
    if (line <= 1) return 0;
    let offset = 0;
    let currentLine = 1;
    while (currentLine < line && offset < text.length) {
      const nextBreak = text.indexOf("\n", offset);
      if (nextBreak === -1) return text.length;
      offset = nextBreak + 1;
      currentLine += 1;
    }
    return offset;
  }

  function getTextareaLineHeight(textarea) {
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
    return Number.isFinite(lineHeight) ? lineHeight : 24;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getTextareaCaretRect(textarea) {
    if (textarea?.coordsAtPos) {
      const cursor = textarea.selectionStart;
      const rect = textarea.coordsAtPos(cursor) || textarea.getBoundingClientRect();
      return { left: rect.left, top: rect.top, bottom: rect.bottom || rect.top + 20 };
    }
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
      menuSearch = "";
      Array.from(menuPanel.querySelectorAll("button")).forEach((item) => item.classList.remove("active"));
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
      menuSearchTimer = setTimeout(() => { menuSearch = ""; }, 2000);
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

  function handleActivityClick(event) {
    const lineButton = event.target.closest("[data-activity-line]");
    if (lineButton) {
      jumpActivePaneToLine(Number(lineButton.dataset.activityLine || 1));
      return;
    }
    const searchButton = event.target.closest("[data-search-index]");
    if (searchButton) {
      jumpToSearchMatch(Number(searchButton.dataset.searchIndex || 0));
      return;
    }
    const actionButton = event.target.closest("[data-search-action]");
    if (actionButton) {
      const action = actionButton.dataset.searchAction;
      if (action === "previous") jumpToSearchMatch(activeSearchIndex - 1);
      if (action === "next") jumpToSearchMatch(activeSearchIndex + 1);
      if (action === "replace-current") replaceCurrentMatch();
      if (action === "replace-all") replaceAllMatches();
      return;
    }
    const toggleButton = event.target.closest("[data-search-toggle]");
    if (toggleButton) {
      const key = toggleButton.dataset.searchToggle;
      searchOptions[key] = !searchOptions[key];
      activeSearchIndex = 0;
      renderSearchActivity();
      return;
    }
    const recentButton = event.target.closest("[data-recent-file]");
    if (recentButton) {
      openPath(recentButton.dataset.recentFile);
    }
  }

  function handleSettingsOverlayInput(event) {
    handleActivityInput(event);
  }

  function handleSettingsOverlayChange(event) {
    handleActivityChange(event);
    renderSettingsOverlay();
  }

  function handleActivityInput(event) {
    if (event.target.classList.contains("search-input")) {
      searchQuery = event.target.value;
      activeSearchIndex = 0;
      renderSearchActivity();
      activityPaneContent.querySelector(".search-input")?.focus();
      return;
    }
    if (event.target.classList.contains("replace-input")) {
      replaceQuery = event.target.value;
    }
  }

  function handleActivityChange(event) {
    const setting = event.target.dataset.setting;
    if (!setting || event.target.disabled) return;
    if (event.target.type === "checkbox") {
      appSettings[setting] = event.target.checked;
    } else {
      appSettings[setting] = event.target.value;
    }
    if (setting === "theme") appSettings.theme = event.target.value;
    if (setting === "showLineNumbers") showLineNumbers = event.target.checked;
    if (setting === "lineWrap") lineWrap = event.target.checked;
    applySettingsToDom();
    if (setting === "showFormattingToolbar") {
      renderWorkspace();
    } else {
      updateAllPanes();
    }
    queueSaveSettings();
    if (!activityPane.hidden && activeActivity === "settings") renderSettingsActivity();
  }

  function startActivityResize(event) {
    event.preventDefault();
    activityResize = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: Number(appSettings.activityPaneWidth) || 280
    };
    activityResizeHandle.setPointerCapture(event.pointerId);
  }

  function handleActivityResize(event) {
    if (!activityResize) return;
    const width = clamp(activityResize.startWidth + event.clientX - activityResize.startX, 220, 520);
    appSettings.activityPaneWidth = width;
    document.documentElement.style.setProperty("--activity-pane-width", `${width}px`);
    requestAnimationFrame(refreshVisibleLineNumbers);
  }

  function stopActivityResize(event) {
    if (!activityResize || event.pointerId !== activityResize.pointerId) return;
    activityResize = null;
    queueSaveSettings();
  }

  function startInspectorResize(event) {
    event.preventDefault();
    inspectorResize = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: Number(appSettings.inspectorWidth) || rightInspector.getBoundingClientRect().width || 360
    };
    inspectorResizeHandle.setPointerCapture(event.pointerId);
  }

  function handleInspectorResize(event) {
    if (!inspectorResize) return;
    const width = clamp(inspectorResize.startWidth + inspectorResize.startX - event.clientX, 280, 620);
    appSettings.inspectorWidth = width;
    document.documentElement.style.setProperty("--inspector-width", `${width}px`);
    requestAnimationFrame(refreshVisibleLineNumbers);
  }

  function stopInspectorResize(event) {
    if (!inspectorResize || event.pointerId !== inspectorResize.pointerId) return;
    inspectorResize = null;
    queueSaveSettings();
  }

  function startPaneResize(event) {
    const doc = getActiveDoc();
    if (!doc || doc.layoutMode !== "split") return;
    event.preventDefault();
    const rect = paneArea.getBoundingClientRect();
    paneResize = {
      pointerId: event.pointerId,
      left: rect.left,
      width: rect.width
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePaneResize(event) {
    const doc = getActiveDoc();
    if (!doc || !paneResize) return;
    doc.splitRatio = clamp((event.clientX - paneResize.left) / Math.max(1, paneResize.width), 0.25, 0.75);
    updatePaneAreaMode(doc);
    requestAnimationFrame(refreshVisibleLineNumbers);
  }

  function stopPaneResize(event) {
    if (!paneResize || event.pointerId !== paneResize.pointerId) return;
    paneResize = null;
    persistFileState();
  }

  function toggleActivityDock() {
    const nextPinned = !activityPinned;
    if (!activityOpen) {
      activityOpen = true;
      activityPane.hidden = false;
    }
    activityPinned = nextPinned;
    if (activityPinned) activityRailVisible = true;
    renderActivityPane();
    applySettingsToDom();
    queueSaveSettings();
  }

  function bindEvents() {
    document.getElementById("newTabButton").addEventListener("click", () => createDocument());
    emptyOpenButton.addEventListener("click", openFiles);
    emptyNewButton.addEventListener("click", () => createDocument());
    activityToggleButton.addEventListener("click", toggleActivityRail);
    topbarInspectorButton.addEventListener("click", toggleInspector);
    inspectorInfoButton.addEventListener("click", () => setInspectorMode("info"));
    inspectorDiffButton.addEventListener("click", () => setInspectorMode("diff"));
    diffChangedOnlyButton.addEventListener("click", () => {
      diffChangedOnly = !diffChangedOnly;
      renderInspector();
    });
    diffInspectorContent.addEventListener("click", (event) => {
      const button = event.target.closest("[data-index-line]");
      if (!button) return;
      jumpActivePaneToLine(Number(button.dataset.indexLine || 1));
    });
    closeInspectorButton.addEventListener("click", () => {
      inspectorOpen = false;
      renderInspector();
      updateToolbar();
      persistFileState();
    });

    document.querySelectorAll(".activity-button").forEach((button) => {
      button.addEventListener("mouseenter", () => {
        if (button.dataset.activity === "settings") return;
        if (!activityPinned) openActivity(button.dataset.activity, false);
      });
      button.addEventListener("click", () => openActivity(button.dataset.activity, activityPinned));
    });
    activityPane.addEventListener("mouseleave", () => {
      if (!activityPinned) closeActivityPane();
    });
    activityPaneCloseButton.addEventListener("click", closeActivityPane);
    activityPaneDockButton.addEventListener("click", toggleActivityDock);
    activityPaneContent.addEventListener("click", handleActivityClick);
    activityPaneContent.addEventListener("input", handleActivityInput);
    activityPaneContent.addEventListener("change", handleActivityChange);
    activityResizeHandle.addEventListener("pointerdown", startActivityResize);
    inspectorResizeHandle.addEventListener("pointerdown", startInspectorResize);
    settingsOverlayCloseButton.addEventListener("click", closeSettingsOverlay);
    settingsOverlay.addEventListener("input", handleSettingsOverlayInput);
    settingsOverlay.addEventListener("change", handleSettingsOverlayChange);

    [appMenuButton, shareButton].forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        openMenuPanel(button.dataset.menu, button);
      });
    });

    window.addEventListener("pointerdown", (event) => {
      if (!menuPanel.contains(event.target)) closeMenuPanel();
      if (!contextMenu.contains(event.target) && !contextFloatingMenus.some((menu) => menu.contains(event.target))) closeContextMenu();
      const activeEditor = getActiveTextarea();
      if (!slashMenu.contains(event.target) && !activeEditor?.contains?.(event.target)) hideSlashMenu();
    });
    window.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("pointermove", handleActivityResize);
    window.addEventListener("pointermove", handleInspectorResize);
    window.addEventListener("pointermove", handlePaneResize);
    window.addEventListener("pointerup", stopActivityResize);
    window.addEventListener("pointerup", stopInspectorResize);
    window.addEventListener("pointerup", stopPaneResize);
    window.addEventListener("resize", () => requestAnimationFrame(refreshVisibleLineNumbers));
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
