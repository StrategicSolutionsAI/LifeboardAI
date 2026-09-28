/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const runReminderSweep = jest.fn()
jest.mock('@/lib/reminders/sweep', () => ({ runReminderSweep: (...a: unknown[]) => runReminderSweep(...a) }))
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ admin: true })) }))

import { POST } from '../route'

const call = (auth?: string) =>
  POST(new NextRequest('http://localhost:3000/api/cron/reminders', { method: 'POST', headers: auth ? { authorization: auth } : {} }))

describe('/api/cron/reminders', () => {
  const env = { ...process.env }
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...env, CRON_SECRET: 's3cret', NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' }
  })
  afterAll(() => { process.env = env })

  it('401 without the secret', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(runReminderSweep).not.toHaveBeenCalled()
  })

  it('401 when no secret is configured, even for an empty bearer', async () => {
    delete process.env.CRON_SECRET
    expect((await call('Bearer ')).status).toBe(401)
    expect((await call('Bearer undefined')).status).toBe(401)
  })

  it('503 when push keys are missing', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    expect((await call('Bearer s3cret')).status).toBe(503)
  })

  it('runs the sweep with the service-role client', async () => {
    runReminderSweep.mockResolvedValue({ users: 2, sent: 3, removedSubscriptions: 0 })
    const res = await call('Bearer s3cret')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ users: 2, sent: 3, removedSubscriptions: 0 })
    expect(runReminderSweep).toHaveBeenCalledWith({ admin: true })
  })
})
