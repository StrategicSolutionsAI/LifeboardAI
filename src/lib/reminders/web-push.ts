import webpush from 'web-push'

export interface StoredSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

let configured = false

/** Null when the VAPID keys are missing, so callers can report it plainly. */
export function pushConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return 'Push is not configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY'
  }
  return null
}

function configure() {
  if (configured) return
  // The contact push services see: an explicit VAPID_SUBJECT, else the site URL.
  const subject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || 'https://lifeboard.ai'
  webpush.setVapidDetails(subject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  configured = true
}

/** 'gone' means the browser dropped the subscription and the row should be deleted. */
export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<'sent' | 'gone' | 'failed'> {
  configure()
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 30 },
    )
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    console.error('Push send failed', status, error instanceof Error ? error.message : error)
    return 'failed'
  }
}
