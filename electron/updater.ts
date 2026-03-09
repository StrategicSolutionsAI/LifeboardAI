import { dialog } from 'electron';

/**
 * Setup auto-updater that checks GitHub Releases for new versions.
 * Uses a dynamic require so the app still launches if electron-updater
 * isn't bundled (e.g. during local dev or if the package is missing).
 */
export function setupUpdater() {
  let autoUpdater: typeof import('electron-updater').autoUpdater;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    autoUpdater = require('electron-updater').autoUpdater;
  } catch {
    console.warn('[updater] electron-updater not available, skipping auto-update');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) of Lifeboard is available.`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The app will restart to install it.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
  });

  // Check for updates after a short delay to not slow down startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[updater] Check failed:', err.message);
    });
  }, 5000);
}
