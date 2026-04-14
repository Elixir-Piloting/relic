import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the API endpoints safely
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  // Window controls
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  // Listen for window state changes
  onWindowMaximize: (callback: () => void) => {
    ipcRenderer.on("window-maximized", callback);
    return () => ipcRenderer.removeAllListeners("window-maximized");
  },
  onWindowUnmaximize: (callback: () => void) => {
    ipcRenderer.on("window-unmaximized", callback);
    return () => ipcRenderer.removeAllListeners("window-unmaximized");
  },
  // File operations
  saveFile: (data: string, defaultFilename: string) => 
    ipcRenderer.invoke("save-file", data, defaultFilename),
});
