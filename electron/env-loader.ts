import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * Load environment variables from .env in the app resources directory.
 * In packaged mode, .env is bundled inside the resources folder.
 * NEXT_PUBLIC_* vars are already inlined at build time via `next build`,
 * so this only needs to set server-side vars (Supabase service key, etc.).
 */
export function loadEnv() {
  const envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    console.warn('[env] No .env file found at', envPath);
    return;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  // Override site URL to point to the local server
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  console.log('[env] loaded from', envPath);
}
