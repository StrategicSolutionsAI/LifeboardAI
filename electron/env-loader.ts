import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * Load environment variables from .env.local (or .env) in the app resources directory.
 * In packaged mode, the file is bundled inside the resources folder.
 * NEXT_PUBLIC_* vars are already inlined at build time via `next build`,
 * so this only needs to set server-side vars (Supabase service key, etc.).
 */
export function loadEnv() {
  const baseDir = app.isPackaged
    ? process.resourcesPath
    : path.resolve(__dirname, '..');

  // Try .env.local first (Next.js convention), then .env
  const candidates = [
    path.join(baseDir, '.env.local'),
    path.join(baseDir, '.env'),
  ];

  const envPath = candidates.find((p) => fs.existsSync(p));

  if (!envPath) {
    console.warn('[env] No .env.local or .env file found in', baseDir);
    return;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  let count = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
      count++;
    }
  }

  // Override site URL to point to the local server
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  console.log(`[env] loaded ${count} vars from ${envPath}`);
}
