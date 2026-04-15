import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { spawn, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

function createWindow() {
  // Get icon path - try multiple locations for compatibility
  let iconPath: string | undefined;
  
  if (isDev) {
    // In development, try relative path from dist folder
    iconPath = path.join(__dirname, "../../web/public/applogo.png");
    // Fallback: try from project root if running from source
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, "../../../web/public/applogo.png");
    }
  } else {
    // In production, try resources path first, then fallback to app path
    iconPath = path.join(process.resourcesPath, "applogo.png");
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(app.getAppPath(), "applogo.png");
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: "#0c1018",
    frame: true, // Use default frame
    show: false,
    icon: iconPath, // Set window icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // In development, load from Next.js dev server
  // In production, serve from Next.js standalone build
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: serve from Next.js standalone build
    // The standalone build will be in resourcesPath/web/.next/standalone
    const nextPath = path.join(process.resourcesPath, "web", ".next", "standalone");
    const serverPath = path.join(nextPath, "server.js");
    
    if (fs.existsSync(serverPath)) {
      // Start Next.js server in background
      nextServer = spawn("node", [serverPath], {
        cwd: nextPath,
        env: { 
          ...process.env, 
          PORT: "3000",
          HOSTNAME: "127.0.0.1",
          NODE_ENV: "production"
        },
        stdio: "ignore",
        detached: false,
      });
      
      // Wait for server to start, then load
      const checkServer = setInterval(() => {
        const http = require("http");
        const req = http.get("http://127.0.0.1:3000", (res: any) => {
          clearInterval(checkServer);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL("http://127.0.0.1:3000");
          }
        });
        req.on("error", () => {
          // Server not ready yet, keep waiting
        });
        req.setTimeout(1000);
      }, 500);
      
      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(checkServer);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL("http://127.0.0.1:3000");
        }
      }, 15000);
    } else {
      // Fallback: show error
      console.error("Next.js build not found at:", serverPath);
      const errorHtml = `
        <html>
          <head><title>Build Error</title></head>
          <body style="font-family: system-ui; padding: 40px; text-align: center; background: #0c1018; color: #fff;">
            <h1>Build Error</h1>
            <p>Next.js build not found.</p>
            <p>Please rebuild the app.</p>
            <p style="font-size: 12px; color: #888; margin-top: 20px;">Path: ${serverPath}</p>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
    }
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Emit window state changes for custom title bar
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized");
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-unmaximized");
  });
}

// Handle window controls
ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("window-close", () => {
  mainWindow?.close();
});

  ipcMain.handle("window-is-maximized", () => {
    return mainWindow?.isMaximized() ?? false;
  });

// Handle file save
ipcMain.handle("save-file", async (_event, data: string, defaultFilename: string) => {
  if (!mainWindow) return { canceled: true };

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFilename,
    filters: [
      { name: "PNG Images", extensions: ["png"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  try {
    // Convert base64 data URL to buffer
    const base64Data = data.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(result.filePath, buffer);
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    console.error("Error saving file:", error);
    return { canceled: true, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");

app.whenReady().then(() => {
  // No native menu bar - using custom title bar instead
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Kill Next.js server if running
  if (nextServer) {
    try {
      nextServer.kill();
      nextServer = null;
    } catch (e) {
      // Ignore errors
    }
  }
  
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Kill Next.js server before quitting
  if (nextServer) {
    try {
      nextServer.kill();
      nextServer = null;
    } catch (e) {
      // Ignore errors
    }
  }
});
