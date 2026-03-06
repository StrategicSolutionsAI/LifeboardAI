import { FETCH_DEFAULT_TIMEOUT_MS } from '@/lib/cache-config'

const DEFAULT_TIMEOUT_MS = FETCH_DEFAULT_TIMEOUT_MS;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
