const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const windows = new Set();
const markdownFilePattern = /\.(md|markdown|mdown|mkd)$/i;
const settingsFileName = "settings.json";

const defaultSettings = {
  theme: "dark",
  accentColor: "#68d8c1",
  accentMode: "theme",
  glass: false,
  appDisplay: "native-compact",
  editorStyle: "clean",
  previewStyle: "document",
  density: "comfortable",
  syntaxMarkers: "fade",
  editorFont: "Cascadia Code",
  previewFont: "Segoe UI",
  showFormattingToolbar: false,
  showLineNumbers: false,
  lineWrap: true,
  scrollSyncAllowed: false,
  activityPaneWidth: 280,
  inspectorWidth: 360,
  lastActivityTool: "outline",
  recentFiles: [],
  fileStates: {}
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function findMarkdownArg(argv) {
  return argv.find((arg) => markdownFilePattern.test(arg));
}

function createWindow(fileToOpen) {
  const isWindows = process.platform === "win32";
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 820,
    minHeight: 560,
    title: "MDBasics",
    backgroundColor: "#121316",
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    transparent: false,
    backgroundMaterial: isWindows ? "mica" : undefined,
    vibrancy: isWindows ? undefined : "under-window",
    visualEffectState: "active",
    titleBarStyle: "hidden",
    titleBarOverlay: isWindows
      ? { color: "#16181d", symbolColor: "#f4f0e8", height: 40 }
      : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  windows.add(win);
  win.on("closed", () => windows.delete(win));
  win.loadFile(path.join(__dirname, "..", "index.html"));

  if (fileToOpen) {
    openPathInWindow(win, fileToOpen);
  }
}

function openPathInWindow(win, filePath) {
  if (!filePath) return;
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("open-file-path", filePath);
    });
  } else {
    win.webContents.send("open-file-path", filePath);
  }
}

function buildMenu() {
  Menu.setApplicationMenu(null);
}

async function readMarkdown(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return { filePath, text };
}

ipcMain.handle("dialog:open", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(owner, {
    title: "Open Markdown",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
      { name: "Text", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(readMarkdown));
});

ipcMain.handle("dialog:confirm-close-unsaved", async (event, payload = {}) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showMessageBox(owner, {
    type: "warning",
    title: "Unsaved changes",
    message: `Save changes to ${payload.title || "this document"}?`,
    detail: "Your changes will be lost if you close without saving.",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });
  return ["save", "discard", "cancel"][result.response] || "cancel";
});

ipcMain.handle("file:read", async (_event, filePath) => readMarkdown(filePath));

ipcMain.handle("file:save", async (_event, payload) => {
  let targetPath = payload.filePath;

  if (!targetPath) {
    const owner = BrowserWindow.fromWebContents(_event.sender);
    const result = await dialog.showSaveDialog(owner, {
      title: "Save Markdown",
      defaultPath: payload.suggestedName || "Untitled.md",
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || !result.filePath) return null;
    targetPath = result.filePath;
  }

  await fs.writeFile(targetPath, payload.text, "utf8");
  return { filePath: targetPath };
});

ipcMain.handle("export:html", async (_event, payload) => {
  const owner = BrowserWindow.fromWebContents(_event.sender);
  const result = await dialog.showSaveDialog(owner, {
    title: "Export HTML",
    defaultPath: payload.suggestedName || "Untitled.html",
    filters: [
      { name: "HTML", extensions: ["html"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, payload.html, "utf8");
  return { filePath: result.filePath };
});

ipcMain.handle("export:word", async (_event, payload) => {
  const owner = BrowserWindow.fromWebContents(_event.sender);
  const result = await dialog.showSaveDialog(owner, {
    title: "Export Word",
    defaultPath: payload.suggestedName || "Untitled.docx",
    filters: [
      { name: "Word Document", extensions: ["docx"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePath) return null;
  await exportWordWithPandoc(payload.markdown, result.filePath);
  return { filePath: result.filePath };
});

ipcMain.handle("export:pdf", async (_event, payload) => {
  const owner = BrowserWindow.fromWebContents(_event.sender);
  const result = await dialog.showSaveDialog(owner, {
    title: "Export PDF",
    defaultPath: payload.suggestedName || "Untitled.pdf",
    filters: [
      { name: "PDF", extensions: ["pdf"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePath) return null;
  const pdf = await renderToPdf(payload.html);
  await fs.writeFile(result.filePath, pdf);
  return { filePath: result.filePath };
});

ipcMain.handle("document:print", async (_event, payload) => printHtml(payload.html));

ipcMain.handle("settings:load", async () => loadSettings());

ipcMain.handle("settings:save", async (_event, settings) => {
  const merged = normalizeSettings(settings);
  await saveSettings(merged);
  return merged;
});

ipcMain.handle("recent-files:list", async () => {
  const settings = await loadSettings();
  return settings.recentFiles;
});

ipcMain.handle("recent-files:add", async (_event, filePath) => {
  if (!filePath) return [];
  const settings = await loadSettings();
  settings.recentFiles = [filePath, ...settings.recentFiles.filter((item) => item !== filePath)].slice(0, 20);
  await saveSettings(settings);
  return settings.recentFiles;
});

ipcMain.handle("window:set-titlebar-theme", async (event, theme) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || process.platform !== "win32") return null;
  win.setTitleBarOverlay({
    color: theme === "light" ? "#f7f7f3" : "#16181d",
    symbolColor: theme === "light" ? "#202124" : "#f4f0e8",
    height: 40
  });
  return { theme };
});

async function renderToPdf(html) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  });

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: "default" },
      pageSize: "A4"
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function printHtml(html) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  });

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await new Promise((resolve, reject) => {
      win.webContents.print({ printBackground: true }, (success, failureReason) => {
        if (!success && failureReason) {
          reject(new Error(failureReason));
        } else {
          resolve({ printed: success });
        }
      });
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function exportWordWithPandoc(markdown, outputPath) {
  const { convert } = await import("pandoc-wasm");
  const outputFile = "document.docx";
  const result = await convert(
    {
      from: "gfm",
      to: "docx",
      standalone: true,
      "output-file": outputFile
    },
    markdown || "",
    {}
  );

  if (result.stderr) {
    console.warn(result.stderr);
  }

  const docxBlob = result.files?.[outputFile];
  if (!docxBlob) {
    throw new Error("Pandoc did not produce a DOCX file.");
  }

  const buffer = Buffer.from(await docxBlob.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
}

function settingsPath() {
  return path.join(app.getPath("userData"), settingsFileName);
}

function normalizeSettings(settings = {}) {
  return {
    ...defaultSettings,
    ...settings,
    recentFiles: Array.isArray(settings.recentFiles) ? settings.recentFiles.slice(0, 20) : [],
    fileStates: settings.fileStates && typeof settings.fileStates === "object" ? settings.fileStates : {}
  };
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(error);
    return normalizeSettings();
  }
}

async function saveSettings(settings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(normalizeSettings(settings), null, 2), "utf8");
}

app.whenReady().then(() => {
  buildMenu();
  createWindow(findMarkdownArg(process.argv));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("second-instance", (_event, argv) => {
  const fileToOpen = findMarkdownArg(argv);
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    createWindow(fileToOpen);
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  openPathInWindow(win, fileToOpen);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
