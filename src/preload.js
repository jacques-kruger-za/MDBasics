const { contextBridge, ipcRenderer } = require("electron");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const TurndownService = require("turndown");

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-"
});

marked.setOptions({
  gfm: true,
  breaks: false
});

function markdownToHtml(text) {
  return sanitizeHtml(marked.parse(text || ""), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "img", "del", "input"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      input: ["type", "checked", "disabled"]
    },
    allowedSchemes: ["http", "https", "mailto", "file", "data"]
  });
}

contextBridge.exposeInMainWorld("mdb", {
  openFiles: () => ipcRenderer.invoke("dialog:open"),
  confirmCloseUnsaved: (payload) => ipcRenderer.invoke("dialog:confirm-close-unsaved", payload),
  readFile: (filePath) => ipcRenderer.invoke("file:read", filePath),
  saveFile: (payload) => ipcRenderer.invoke("file:save", payload),
  exportHtml: (payload) => ipcRenderer.invoke("export:html", payload),
  exportPdf: (payload) => ipcRenderer.invoke("export:pdf", payload),
  exportWord: (payload) => ipcRenderer.invoke("export:word", payload),
  printDocument: (payload) => ipcRenderer.invoke("document:print", payload),
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  listRecentFiles: () => ipcRenderer.invoke("recent-files:list"),
  addRecentFile: (filePath) => ipcRenderer.invoke("recent-files:add", filePath),
  setTitlebarTheme: (theme) => ipcRenderer.invoke("window:set-titlebar-theme", theme),
  markdownToHtml,
  htmlToMarkdown: (html) => turndown.turndown(html || ""),
  onOpenPath: (callback) => ipcRenderer.on("open-file-path", (_event, filePath) => callback(filePath))
});
