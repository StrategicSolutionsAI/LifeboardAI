import { FETCH_DEFAULT_TIMEOUT_MS } from '@/lib/cache-config'
import { SESSION_EXPIRED_HEADER } from '@/lib/session-expired'

const DEFAULT_TIMEOUT_MS = FETCH_DEFAULT_TIMEOUT_MS;

let redirectingToLogin = false;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    // Routes mark app-session 401s with this header; provider-auth 401s
    // (e.g. an expired Todoist token) don't carry it and must NOT sign the
    // user out. Header check only — never parse the body here, the caller
    // still owns it.
    if (
      res.status === 401 &&
      typeof window !== 'undefined' &&
      !redirectingToLogin &&
      res.headers.get(SESSION_EXPIRED_HEADER) === '1'
    ) {
      redirectingToLogin = true;
      window.location.assign('/login');
    }
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}
