/**
 * Check if the app is running inside an Electron shell.
 * Safe to call on both client and server — returns false on the server.
 */
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as Record<string, unknown>).electronAPI;
}
