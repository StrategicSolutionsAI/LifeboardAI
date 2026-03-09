import { BrowserWindow, shell } from 'electron';

/**
 * Domains that are part of OAuth flows and should stay inside the Electron window.
 * Everything else opens in the system browser.
 */
const ALLOWED_NAVIGATION_DOMAINS = [
  'localhost',
  '127.0.0.1',
  // OAuth providers
  'accounts.google.com',
  'www.googleapis.com',
  'todoist.com',
  'account.withings.com',
  'accounts.fitbit.com',
  'www.fitbit.com',
  // Supabase auth
  'supabase.co',
];

function isAllowedDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_NAVIGATION_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Intercept navigation in the main window.
 * Allow OAuth provider domains so the flow completes inside the app.
 * Open everything else in the user's default browser.
 */
export function setupOAuthHandler(win: BrowserWindow) {
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedDomain(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}
