import { NextResponse } from 'next/server'
import { RATE_LIMIT_CLEANUP_INTERVAL_MS } from '@/lib/cache-config'

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Each limiter instance tracks request timestamps per key (typically IP or
 * user ID). Old entries are pruned on every check to avoid memory leaks.
 *
 * NOTE: In a serverless environment (Vercel), each instance only sees its
 * own traffic. This provides per-instance protection — for global limits
 * across all instances, use a distributed store (e.g. Upstash Redis).
 */

interface RateLimitConfig {
  /** Maximum requests allowed within the window. */
  maxRequests: number
  /** Time window in milliseconds. */
  windowMs: number
}

interface RateLimitEntry {
  timestamps: number[]
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private readonly maxRequests: number
  private readonly windowMs: number
  private lastCleanup = Date.now()
  private readonly cleanupInterval = RATE_LIMIT_CLEANUP_INTERVAL_MS

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowMs
  }

  /**
   * Check if a request from `key` should be allowed.
   * Returns `null` if allowed, or a `NextResponse` with 429 if rate limited.
   */
  check(key: string): NextResponse | null {
    const now = Date.now()
    this.maybeCleanup(now)

    let entry = this.store.get(key)
    if (!entry) {
      entry = { timestamps: [] }
      this.store.set(key, entry)
    }

    // Remove timestamps outside the window
    const windowStart = now - this.windowMs
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

    if (entry.timestamps.length >= this.maxRequests) {
      const retryAfterMs = entry.timestamps[0] + this.windowMs - now
      const retryAfterSec = Math.ceil(retryAfterMs / 1000)

      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(this.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(
              Math.ceil((entry.timestamps[0] + this.windowMs) / 1000)
            ),
          },
        }
      )
    }

    entry.timestamps.push(now)
    return null // allowed
  }

  /** Periodically prune keys that have no recent activity. */
  private maybeCleanup(now: number) {
    if (now - this.lastCleanup < this.cleanupInterval) return
    this.lastCleanup = now

    const windowStart = now - this.windowMs
    this.store.forEach((entry, key) => {
      entry.timestamps = entry.timestamps.filter((t: number) => t > windowStart)
      if (entry.timestamps.length === 0) {
        this.store.delete(key)
      }
    })
  }
}

/**
 * Extract a rate limit key from a request.
 * Prefers authenticated user ID, falls back to IP address.
 */
export function getRateLimitKey(
  request: Request,
  userId?: string | null
): string {
  if (userId) return `user:${userId}`

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `ip:${ip}`
}

// ── Pre-configured limiters ──────────────────────────────────────────────

/** Chat routes: 20 requests per minute (generous for normal use, blocks abuse). */
export const chatLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60_000,
})

/** General API routes: 60 requests per minute. */
export const apiLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60_000,
})
