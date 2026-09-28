/**
 * An invite link opened while signed out is remembered in this cookie so the
 * user comes back to /join/<token> to confirm after signing up or in —
 * whichever path they take (email, Google, email confirmation).
 */
export const PENDING_INVITE_COOKIE = 'lb_pending_invite'
export const PENDING_INVITE_MAX_AGE_S = 7 * 24 * 60 * 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The /join path to confirm a remembered invite, or null. */
export function pendingInvitePath(token: string | undefined | null): string | null {
  return token && UUID.test(token) ? `/join/${token}` : null
}
