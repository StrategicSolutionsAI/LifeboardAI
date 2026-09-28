import { getGmailForUser } from '@/lib/gmail/client'

// RFC 2047 so household names with accents or emoji survive the Subject header.
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

export function buildInviteMessage(opts: {
  to: string
  inviterName: string
  householdName: string
  inviteUrl: string
}): string {
  const body = [
    `${opts.inviterName} invited you to join "${opts.householdName}" on Lifeboard.`,
    '',
    'You will share a calendar, tasks, a shopping list and a budget.',
    '',
    `Join here: ${opts.inviteUrl}`,
  ].join('\r\n')

  return [
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(`Join ${opts.householdName} on Lifeboard`)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body, 'utf8').toString('base64'),
  ].join('\r\n')
}

/**
 * Sends the invite from the inviter's own connected Gmail. Returns false when
 * Gmail isn't connected or the send fails — the invite link still works and
 * the UI offers it for copying, so this never throws.
 */
export async function sendInviteViaGmail(
  supabase: any,
  userId: string,
  message: Parameters<typeof buildInviteMessage>[0],
): Promise<boolean> {
  try {
    const gmail = await getGmailForUser(supabase, userId)
    if (!gmail) return false
    const raw = Buffer.from(buildInviteMessage(message))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return true
  } catch (error) {
    console.error('Household invite: Gmail send failed', error instanceof Error ? error.message : error)
    return false
  }
}
