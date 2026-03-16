const ALLOWED_PREFIXES = [
  '/dashboard',
  '/integrations',
  '/onboarding',
  '/calendar',
  '/tasks',
  '/profile',
  '/settings',
  '/shopping-list',
  '/history',
  '/trends',
  '/folders',
  '/email',
]

/**
 * Validates and sanitizes a redirect URL to prevent open redirect attacks.
 * Only allows relative paths starting with a known prefix.
 * Blocks protocol-relative URLs (//evil.com), absolute URLs, and unknown paths.
 */
export function sanitizeRedirectUrl(
  url: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!url) return fallback
  // Must start with exactly one `/` followed by a letter (blocks //, /\, protocol-relative)
  if (!/^\/[a-zA-Z]/.test(url)) return fallback
  // Must match an allowed path prefix
  const matches = ALLOWED_PREFIXES.some(
    (p) => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'),
  )
  return matches ? url : fallback
}
