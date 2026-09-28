// Browser side of task reminders: permission, the push worker, and the
// subscription the server sends to. The worker gets its own narrow scope so it
// never serves page requests (see public/push-sw.js).
const WORKER_URL = '/push-sw.js'
const WORKER_SCOPE = '/push-notifications/'

export type ReminderStatus = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(WORKER_SCOPE)
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function getReminderStatus(): Promise<ReminderStatus> {
  // iOS only exposes web push to apps added to the Home Screen.
  if (!isSupported()) return isIos() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return (await currentSubscription()) ? 'on' : 'off'
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(WORKER_URL, { scope: WORKER_SCOPE })
  const worker = registration.installing ?? registration.waiting
  if (!registration.active && worker) {
    // pushManager.subscribe needs an active worker.
    await new Promise<void>((resolve) => {
      worker.addEventListener('statechange', () => { if (worker.state === 'activated') resolve() })
    })
  }
  return registration
}

async function post(url: string, method: string, body?: unknown): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export async function enableReminders(): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('Reminders are not configured on this server')
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notifications are blocked. Allow them in your browser settings, then try again.')
  }
  const registration = await activeRegistration()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))
  const { endpoint, keys } = subscription.toJSON()
  await post('/api/push/subscribe', 'POST', {
    endpoint,
    keys,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

export async function disableReminders(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await post('/api/push/subscribe', 'DELETE', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

export async function sendTestReminder(): Promise<void> {
  await post('/api/push/test', 'POST')
}
