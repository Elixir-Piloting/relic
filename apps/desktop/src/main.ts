import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { spawn, ChildProcess } from "child_process";

if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-setuid-sandbox");
}

let mainWindow: BrowserWindow | null = null;
let nextProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

const RESOURCE_PATH = process.resourcesPath || "";
const NEXT_PATH = path.join(RESOURCE_PATH, "web", ".next", "standalone", "projects", "relic", "apps", "web");

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.setMaxListeners(20);
    
    const cleanup = () => {
      try { server.close(); } catch {}
    };
    
    server.on("error", (err: NodeJS.ErrnoException) => {
      cleanup();
      if (err.code === "EADDRINUSE") {
        resolve(startPort + 1);
      } else {
        reject(err);
      }
    });
    
    server.listen(startPort, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : startPort;
      cleanup();
      resolve(port);
    });
  });
}

function createWindow(url?: string) {
  let iconPath: string | undefined;
  
  if (app.isPackaged) {
    iconPath = path.join(RESOURCE_PATH, "applogo.png");
  } else {
    iconPath = path.join(__dirname, "../../web/public/applogo.png");
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, "../../../web/public/applogo.png");
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: "#0c1018",
    frame: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else if (url) {
    mainWindow.loadURL(url);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized");
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-unmaximized");
  });
}

async function startServer(): Promise<void> {
  const serverPath = path.join(NEXT_PATH, "server.js");
  
  if (!fs.existsSync(serverPath)) {
    console.error("Server not found:", serverPath);
    return;
  }

  try {
    const port = await findAvailablePort(3000);
    console.log("Starting Next.js on port:", port);
    
    nextProcess = spawn("node", [serverPath], {
      cwd: NEXT_PATH,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    nextProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      console.log("[Next]", text.trim());
      
      if (text.includes("Ready")) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`http://localhost:${port}`);
        }
      }
    });

    nextProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[Next Error]", data.toString().trim());
    });

    nextProcess.on("error", (err) => {
      console.error("Process error:", err);
    });
    
  } catch (err) {
    console.error("Failed to start Next.js:", err);
    createWindow();
  }
}

function stopServer() {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
}

ipcMain.handle("window-minimize", () => mainWindow?.minimize());
ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle("window-close", () => mainWindow?.close());
ipcMain.handle("window-is-maximized", () => mainWindow?.isMaximized() ?? false);

ipcMain.handle("save-file", async (_event, data: string, defaultFilename: string) => {
  if (!mainWindow) return { canceled: true };

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFilename,
    filters: [
      { name: "PNG Images", extensions: ["png"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return { canceled: true };

  try {
    const base64Data = data.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(result.filePath, buffer);
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

app.whenReady().then(async () => {
  if (app.isPackaged) {
    createWindow();
    await startServer();
  } else {
    createWindow();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopServer();
});
