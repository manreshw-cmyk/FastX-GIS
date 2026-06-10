const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, Menu, shell } = require("electron");

const isDev = !app.isPackaged;
let mainWindow = null;

function writeLog(message, detail) {
  try {
    const logDir = process.env.FASTX_ELECTRON_LOG_DIR || app.getPath("userData");
    fs.mkdirSync(logDir, { recursive: true });
    const suffix = detail === undefined ? "" : ` ${JSON.stringify(detail)}`;
    fs.appendFileSync(
      path.join(logDir, "fastx-desktop.log"),
      `[${new Date().toISOString()}] ${message}${suffix}\n`,
    );
  } catch {
    // Logging must never affect application startup.
  }
}

function resolveAppIndex() {
  return path.join(__dirname, "..", "FastXDist", "index.html");
}

function resolveAppIcon() {
  return path.join(__dirname, "icon.ico");
}

function createWindow() {
  const indexPath = resolveAppIndex();
  writeLog("create-window", { isDev, indexPath });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    title: "FastX GIS",
    icon: resolveAppIcon(),
    autoHideMenuBar: true,
    backgroundColor: "#081824",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    writeLog("ready-to-show");
    mainWindow.show();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    writeLog("did-finish-load", { url: mainWindow.webContents.getURL() });
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    writeLog("did-fail-load", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    writeLog("render-process-gone", details);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("file:")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    writeLog("window-closed");
    mainWindow = null;
  });

  if (isDev && process.env.FASTX_ELECTRON_DEV_URL) {
    mainWindow.loadURL(process.env.FASTX_ELECTRON_DEV_URL).catch((error) => {
      writeLog("load-url-error", { message: error.message });
    });
  } else {
    mainWindow.loadFile(indexPath).catch((error) => {
      writeLog("load-file-error", { message: error.message, indexPath });
    });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  writeLog("app-ready", { packaged: app.isPackaged, version: app.getVersion() });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  writeLog("window-all-closed");
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  writeLog("before-quit");
});

app.on("quit", (_event, exitCode) => {
  writeLog("quit", { exitCode });
});

process.on("uncaughtException", (error) => {
  writeLog("uncaught-exception", { message: error.message, stack: error.stack });
});

process.on("unhandledRejection", (reason) => {
  writeLog("unhandled-rejection", { reason: String(reason) });
});
