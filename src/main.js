const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const windows = new Set();

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
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("open-file-path", fileToOpen);
    });
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

ipcMain.handle("menu:popup", async (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;

  const menu = Menu.buildFromTemplate(getPopupMenuTemplate(event.sender, payload.name));
  menu.popup({
    window: win,
    x: Math.round(payload.x || 0),
    y: Math.round(payload.y || 0)
  });
  return { opened: payload.name };
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

function getPopupMenuTemplate(sender, name) {
  const send = (channel) => () => sender.send(channel);
  const templates = {
    file: [
      { label: "New Tab", accelerator: "Ctrl+N", click: send("menu:new-tab") },
      { label: "Close Tab", accelerator: "Ctrl+W", click: send("menu:close-tab") },
      { type: "separator" },
      { label: "Open...", accelerator: "Ctrl+O", click: send("menu:open") },
      { label: "Save", accelerator: "Ctrl+S", click: send("menu:save") },
      { label: "Save As...", accelerator: "Ctrl+Shift+S", click: send("menu:save-as") },
      { type: "separator" },
      { label: "Print...", accelerator: "Ctrl+P", click: send("menu:print") },
      { type: "separator" },
      { label: "Export HTML", click: send("menu:export-html") },
      { label: "Export PDF", click: send("menu:export-pdf") },
      { label: "Export Word", click: send("menu:export-word") }
    ],
    edit: [
      { label: "Undo", accelerator: "Ctrl+Z", click: send("menu:undo") },
      { label: "Redo", accelerator: "Ctrl+Y", click: send("menu:redo") },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" }
    ],
    view: [
      { label: "Code", accelerator: "Ctrl+1", click: send("menu:code-view") },
      { label: "Rendered", accelerator: "Ctrl+2", click: send("menu:render-view") },
      { label: "Diff", accelerator: "Ctrl+3", click: send("menu:diff-view") }
    ],
    settings: [
      { label: "Toggle Light/Dark", click: send("menu:toggle-theme") },
      { label: "Toggle Glass", click: send("menu:toggle-glass") },
      { label: "Toggle Line Wrap", click: send("menu:toggle-line-wrap") }
    ]
  };

  return templates[name] || [];
}

async function renderToPdf(html) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  });

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    margins: { marginType: "default" },
    pageSize: "A4"
  });
  win.destroy();
  return pdf;
}

async function printHtml(html) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  });

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return new Promise((resolve, reject) => {
    win.webContents.print({ printBackground: true }, (success, failureReason) => {
      win.destroy();
      if (!success && failureReason) {
        reject(new Error(failureReason));
      } else {
        resolve({ printed: success });
      }
    });
  });
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

app.whenReady().then(() => {
  buildMenu();
  createWindow(process.argv.find((arg) => /\.(md|markdown|mdown|mkd)$/i.test(arg)));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
