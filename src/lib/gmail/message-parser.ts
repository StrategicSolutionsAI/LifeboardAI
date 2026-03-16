import type { gmail_v1 } from 'googleapis'

export interface ParsedEmail {
  id: string
  threadId: string
  from: string
  to: string
  cc: string
  date: string
  subject: string
  snippet: string
  labelIds: string[]
  isUnread: boolean
  textBody: string
  htmlBody: string
  attachments: AttachmentMeta[]
}

export interface AttachmentMeta {
  filename: string
  mimeType: string
  size: number
  attachmentId: string
}

/**
 * Extract a header value from the Gmail message payload headers array.
 */
export function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  if (!headers) return ''
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  )
  return header?.value ?? ''
}

/**
 * Decode a base64url-encoded string (as returned by the Gmail API).
 */
function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

interface BodyResult {
  textBody: string
  htmlBody: string
  attachments: AttachmentMeta[]
}

/**
 * Recursively walk MIME parts to find text/plain, text/html bodies and attachment metadata.
 */
function walkParts(part: gmail_v1.Schema$MessagePart | undefined): BodyResult {
  const result: BodyResult = { textBody: '', htmlBody: '', attachments: [] }
  if (!part) return result

  const mimeType = part.mimeType ?? ''

  // Leaf part with body data
  if (part.body?.data) {
    if (mimeType === 'text/plain' && !result.textBody) {
      result.textBody = decodeBase64Url(part.body.data)
    } else if (mimeType === 'text/html' && !result.htmlBody) {
      result.htmlBody = decodeBase64Url(part.body.data)
    }
  }

  // Attachment (has attachmentId or a filename with body size)
  if (part.body?.attachmentId && part.filename) {
    result.attachments.push({
      filename: part.filename,
      mimeType,
      size: part.body.size ?? 0,
      attachmentId: part.body.attachmentId,
    })
  }

  // Recurse into child parts (multipart/*)
  if (part.parts) {
    for (const child of part.parts) {
      const childResult = walkParts(child)
      if (!result.textBody && childResult.textBody) {
        result.textBody = childResult.textBody
      }
      if (!result.htmlBody && childResult.htmlBody) {
        result.htmlBody = childResult.htmlBody
      }
      result.attachments.push(...childResult.attachments)
    }
  }

  return result
}

/**
 * Parse a full Gmail API message into a flat, usable structure.
 */
export function parseGmailMessage(
  message: gmail_v1.Schema$Message,
  includeBody = false,
): ParsedEmail {
  const headers = message.payload?.headers
  const { textBody, htmlBody, attachments } = includeBody
    ? walkParts(message.payload)
    : { textBody: '', htmlBody: '', attachments: [] as AttachmentMeta[] }

  // Collect attachment metadata even for list view (no body)
  const attachmentMeta = includeBody
    ? attachments
    : walkParts(message.payload).attachments

  return {
    id: message.id ?? '',
    threadId: message.threadId ?? '',
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc'),
    date: getHeader(headers, 'Date'),
    subject: getHeader(headers, 'Subject'),
    snippet: message.snippet ?? '',
    labelIds: message.labelIds ?? [],
    isUnread: message.labelIds?.includes('UNREAD') ?? false,
    textBody,
    htmlBody,
    attachments: includeBody ? attachments : attachmentMeta,
  }
}

/**
 * Parse a short summary for list view (metadata only, no body decode).
 */
export function parseGmailMessageSummary(
  message: gmail_v1.Schema$Message,
): Omit<ParsedEmail, 'textBody' | 'htmlBody'> {
  const headers = message.payload?.headers

  return {
    id: message.id ?? '',
    threadId: message.threadId ?? '',
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc'),
    date: getHeader(headers, 'Date'),
    subject: getHeader(headers, 'Subject'),
    snippet: message.snippet ?? '',
    labelIds: message.labelIds ?? [],
    isUnread: message.labelIds?.includes('UNREAD') ?? false,
    attachments: [],
  }
}

// ── Shared email header helpers ─────────────────────────────────────────

/**
 * Extract the display name from a From header like `"Jane Doe" <jane@example.com>`.
 * Falls back to the local-part before `@`.
 */
export function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match?.[1]?.trim() || from.split('@')[0]
}

/**
 * Extract the bare email address from a From header.
 */
export function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match?.[1] || from
}

/**
 * Parse a `List-Unsubscribe` header value (RFC 2369) into HTTP URL and mailto components.
 * The header format is: `<https://example.com/unsub>, <mailto:unsub@example.com>`
 */
export function parseListUnsubscribe(header: string): {
  httpUrl: string | null
  mailto: string | null
} {
  if (!header) return { httpUrl: null, mailto: null }

  let httpUrl: string | null = null
  let mailto: string | null = null

  // Extract all <...> entries
  const entries = header.match(/<[^>]+>/g) || []
  for (const entry of entries) {
    const value = entry.slice(1, -1).trim()
    if (value.startsWith('http://') || value.startsWith('https://')) {
      if (!httpUrl) httpUrl = value
    } else if (value.startsWith('mailto:')) {
      if (!mailto) mailto = value
    }
  }

  return { httpUrl, mailto }
}
