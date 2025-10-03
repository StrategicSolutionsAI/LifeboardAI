/**
 * @jest-environment node
 */
import { formatDateTime } from '../route'

describe('formatDateTime', () => {
  it('preserves UTC timestamps ending with Z', () => {
    expect(formatDateTime('20240107T090000Z')).toBe('2024-01-07T09:00:00Z')
  })

  it('keeps floating times when no timezone is provided', () => {
    expect(formatDateTime('20240107T090000')).toBe('2024-01-07T09:00:00')
  })

  it('attaches the correct negative offset for western timezones', () => {
    expect(formatDateTime('20240107T090000', 'America/Los_Angeles')).toBe('2024-01-07T09:00:00-08:00')
  })

  it('attaches the correct positive offset for eastern timezones', () => {
    expect(formatDateTime('20240107T090000', 'Asia/Kolkata')).toBe('2024-01-07T09:00:00+05:30')
  })
})
