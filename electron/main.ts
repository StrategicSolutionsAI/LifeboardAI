import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { setupMenu } from './menu';
import { setupTray } from './tray';
import { loadWindowState, saveWindowState } from './window-state';
import { loadEnv } from './env-loader';
import { startNextServer, stopNextServer } from './next-server';
import { setupOAuthHandler } from './oauth-handler';
import { setupUpdater } from './updater';

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_URL = 'http://localhost:3000';

let mainWindow: BrowserWindow | null = null;

// Single instance lock — quit if another instance is already running
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function createWindow(serverUrl: string) {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width ?? 1280,
    height: windowState.height ?? 800,
    x: windowState.x,
    y: windowState.y,
    minWidth: 900,
    minHeight: 600,
    show: false, // ready-to-show pattern
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (windowState.isMaximized) {
      mainWindow?.maximize();
    }
  });

  // Save window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Setup OAuth navigation handling
  setupOAuthHandler(mainWindow);

  mainWindow.loadURL(serverUrl);
}

// IPC handlers for window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  let serverUrl: string;

  if (isDev) {
    serverUrl = DEV_SERVER_URL;
  } else {
    loadEnv();
    serverUrl = await startNextServer();
  }

  createWindow(serverUrl);
  setupMenu(mainWindow!);
  setupTray(mainWindow!, serverUrl);

  if (!isDev) {
    setupUpdater();
  }

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(serverUrl);
      setupMenu(mainWindow!);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopNextServer();
});
