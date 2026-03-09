import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Navigation (triggered from native menus)
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on('navigate', (_event, path: string) => callback(path));
    return () => {
      ipcRenderer.removeAllListeners('navigate');
    };
  },
});
