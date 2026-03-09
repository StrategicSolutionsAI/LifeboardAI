import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function setupTray(mainWindow: BrowserWindow, _serverUrl: string) {
  // Use a 16x16 or 22x22 template image for the tray
  const iconPath = path.join(__dirname, '..', 'electron', 'resources', 'tray-icon.png');
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch {
    // Fallback: create a small placeholder icon
    icon = nativeImage.createEmpty();
  }

  // On macOS, use template images for dark/light menu bar
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Lifeboard.ai');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Lifeboard',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('navigate', '/dashboard');
      },
    },
    {
      label: 'Calendar',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('navigate', '/calendar');
      },
    },
    {
      label: 'Tasks',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('navigate', '/tasks');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}
