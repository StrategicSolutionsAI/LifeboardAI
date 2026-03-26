/**
 * Shared types, prompts, and helpers for AI email agents
 * (spam detection, organization, smart reply).
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface EmailSummaryForAI {
  messageId: string
  from: string
  subject: string
  snippet: string
  date: string
}

export interface SpamClassification {
  messageId: string
  isSpam: boolean
  confidence: number
  reason: string
}

export type EmailCategoryName =
  | 'Important'
  | 'Work'
  | 'Personal'
  | 'Newsletter'
  | 'Receipt'
  | 'Social'
  | 'Notification'
  | 'Promotional'

export interface EmailCategory {
  messageId: string
  category: EmailCategoryName
  confidence: number
  reason: string
}

export interface MarketingClassification {
  messageId: string
  isMarketing: boolean
  confidence: number
  reason: string
  senderEmail: string
  senderName: string
}

// ── Constants ────────────────────────────────────────────────────────────

export const SPAM_BATCH_SIZE = 30
export const ORGANIZE_BATCH_SIZE = 25
export const MARKETING_BATCH_SIZE = 50

export const CATEGORY_LABEL_COLORS: Record<EmailCategoryName, { textColor: string; backgroundColor: string }> = {
  Important:    { textColor: '#ffffff', backgroundColor: '#cc3a21' },
  Work:         { textColor: '#ffffff', backgroundColor: '#285bac' },
  Personal:     { textColor: '#ffffff', backgroundColor: '#0d7813' },
  Newsletter:   { textColor: '#ffffff', backgroundColor: '#684e98' },
  Receipt:      { textColor: '#ffffff', backgroundColor: '#a46a21' },
  Social:       { textColor: '#ffffff', backgroundColor: '#b65775' },
  Notification: { textColor: '#ffffff', backgroundColor: '#41236d' },
  Promotional:  { textColor: '#ffffff', backgroundColor: '#89765c' },
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function buildEmailSummariesForAI(
  emails: Array<{ id: string; from: string; subject: string; snippet: string; date: string }>,
): EmailSummaryForAI[] {
  return emails.map((e) => ({
    messageId: e.id,
    from: e.from,
    subject: e.subject,
    snippet: (e.snippet || '').slice(0, 200),
    date: e.date,
  }))
}

// ── Prompts ──────────────────────────────────────────────────────────────

export function buildSpamDetectionPrompt(): string {
  return `You are an email spam detection assistant. Analyze the following batch of emails and classify each one as spam or not spam.

Rules:
- Be CONSERVATIVE. When in doubt, classify as NOT spam.
- Marketing emails from companies the user likely signed up for are NOT spam.
- Newsletters, receipts, order confirmations are NOT spam.
- Only flag obvious unsolicited junk, phishing attempts, or deceptive emails as spam.
- Phishing indicators: mismatched sender domains, urgency tactics, suspicious links, requests for credentials.
- Spam indicators: unknown senders with generic subjects, "You've won" type messages, unsolicited offers.

Respond with a JSON array. Each element must have these exact fields:
- messageId (string): the message ID from the input
- isSpam (boolean): true if spam, false if not
- confidence (number): 0.0 to 1.0
- reason (string): brief explanation (10 words max)

Respond ONLY with the JSON array, no other text.`
}

export function buildOrganizationPrompt(): string {
  return `You are an email organization assistant. Categorize each email into exactly ONE of these categories:

Categories:
- Important: urgent, time-sensitive, from known contacts about critical matters
- Work: professional correspondence, meetings, project updates
- Personal: friends, family, personal matters
- Newsletter: subscribed newsletters, blog digests, content updates
- Receipt: purchase confirmations, invoices, shipping notifications
- Social: social media notifications, community updates
- Notification: automated system notifications, alerts, reminders
- Promotional: marketing emails, sales, offers, deals

Rules:
- Choose the MOST specific category that fits.
- When unsure between two categories, pick the one that better describes the primary purpose.

Respond with a JSON array. Each element must have these exact fields:
- messageId (string): the message ID from the input
- category (string): one of the category names above (exact spelling)
- confidence (number): 0.0 to 1.0
- reason (string): brief explanation (10 words max)

Respond ONLY with the JSON array, no other text.`
}

export function buildSmartReplyPrompt(userEmail: string): string {
  return `You are a helpful email reply assistant. Generate a professional, concise reply to the email below.

Guidelines:
- Match the tone of the original email (formal/casual).
- Be helpful and direct.
- Keep the reply concise — 2-5 sentences for most emails.
- Do NOT include a subject line.
- Sign off with the user's name extracted from their email: ${userEmail}
- Use a simple sign-off like "Best," or "Thanks," followed by their first name.
- Do NOT include email headers (To, From, etc.).
- Output ONLY the reply body text, nothing else.`
}

export function buildMarketingDetectionPrompt(): string {
  return `You are an email marketing detector. Classify each email as marketing or not marketing.

Marketing emails include:
- Promotional offers, sales, deals, coupons
- Marketing newsletters and product announcements
- Automated drip campaigns and onboarding sequences
- Social media digest emails (LinkedIn, Twitter/X, Facebook notifications)
- Event invitations from companies/services
- "We miss you" or re-engagement emails
- Weekly/monthly roundups from services

NOT marketing:
- Personal emails from real people
- Transactional emails (order confirmations, shipping updates, receipts, password resets)
- Calendar invitations from real people
- Work/professional correspondence
- Account security alerts
- Direct customer support replies

Rules:
- Be AGGRESSIVE in flagging marketing. When in doubt, classify as marketing.
- Bulk senders are almost always marketing.
- Even if the user signed up, promotional content is still marketing.

Respond with a JSON array. Each element must have these exact fields:
- messageId (string): the message ID from the input
- isMarketing (boolean): true if marketing, false if not
- confidence (number): 0.0 to 1.0
- reason (string): brief explanation (10 words max)

Respond ONLY with the JSON array, no other text.`
}

// ── Task Extraction Types & Prompt ───────────────────────────────────────

export interface TaskExtraction {
  title: string
  description: string
  dueDate: string | null
  dueTime: string | null
  location: string | null
  suggestedBucket: string | null
  sourceEmailSubject: string
  confidence: number
}

export function buildTaskExtractionPrompt(currentDate: string, buckets: string[]): string {
  const bucketList = buckets.length > 0
    ? `Available buckets: ${buckets.map(b => `"${b}"`).join(', ')}`
    : 'No buckets configured — set suggestedBucket to null.'

  return `You are a task extraction assistant for a personal life management app called LifeboardAI. Analyze a batch of emails and identify any actionable items that could become tasks for the user.

Today's date is ${currentDate}.
${bucketList}

Look for:
- Action items: things the user needs to do, respond to, prepare, attend, submit, review, etc.
- Appointments and meetings: scheduled events with dates/times
- Deadlines: due dates for projects, applications, payments, etc.
- Requests: someone asking the user to do something
- Events: invitations, RSVPs, reservations
- Follow-ups: things to check on later

Extract the following for each task:
- title: A concise, actionable task title (start with a verb, e.g., "Review proposal from John", "Attend team meeting")
- description: Brief details from the email relevant to this task (key context, people involved, requirements)
- dueDate: ISO date string (YYYY-MM-DD) if a date is mentioned or can be inferred. Use null if no date.
- dueTime: Time in HH:MM 24-hour format if a specific time is mentioned. Use null if no time.
- location: Physical or virtual location if mentioned (address, room, Zoom link, etc.). Use null if none.
- suggestedBucket: Pick the most fitting bucket from the available list. Match by relevance (e.g., work tasks → "Work", personal errands → "Personal", health items → "Health"). Use null if no bucket fits or no buckets are available.
- sourceEmailSubject: The subject line of the email this task came from.
- confidence: 0.0 to 1.0 — how confident you are this is an actionable task

Rules:
- Only extract genuinely actionable items. Marketing emails, newsletters, and notifications usually have NO tasks.
- Be conservative. If unsure whether something is a task, set confidence below 0.5.
- Return an empty array if no tasks are found across all emails.
- Maximum 3 tasks per email, 10 tasks total across the batch.
- For relative dates ("next Monday", "tomorrow", "in 2 weeks"), compute the actual date based on today's date.

Respond with a JSON array. Each element must have the exact fields described above.
Respond ONLY with the JSON array, no other text.`
}

// ── JSON Parser ──────────────────────────────────────────────────────────

/**
 * Parse an LLM response that should contain JSON.
 * Strips markdown code fences and any surrounding text.
 */
export function parseAIJsonResponse<T>(raw: string): T {
  // Strip markdown code fences
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
  cleaned = cleaned.trim()

  // Try to find JSON array or object
  const jsonStart = cleaned.search(/[\[{]/)
  const jsonEndBracket = cleaned.lastIndexOf(']')
  const jsonEndBrace = cleaned.lastIndexOf('}')
  const jsonEnd = Math.max(jsonEndBracket, jsonEndBrace)

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1)
  }

  return JSON.parse(cleaned)
}
