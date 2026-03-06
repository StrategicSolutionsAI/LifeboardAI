import type { Message } from './chat-types'

/** Format a timestamp for display next to a message */
export function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Format a day divider label */
export function formatDayDivider(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Determine if a day divider should be shown before this message */
export function shouldShowDivider(messages: { timestamp?: number }[], index: number): boolean {
  const curr = messages[index]?.timestamp
  if (!curr) return false
  if (index === 0) return true
  const prev = messages[index - 1]?.timestamp
  if (!prev) return true
  return new Date(curr).toDateString() !== new Date(prev).toDateString()
}

/** Generate contextual follow-up chips based on the last assistant message */
export function getFollowUpChips(lastAssistantMsg: Message | undefined): string[] {
  if (!lastAssistantMsg) return []
  const c = lastAssistantMsg.content.toLowerCase()
  if (lastAssistantMsg.createdTask) return ['Show my tasks', 'Add another task']
  if (/calendar|event|schedule|meeting/i.test(c)) return ['Show my calendar', "What's next today?"]
  if (/task|todo|reminder/i.test(c)) return ['Show my tasks', 'What should I focus on?']
  return ['Tell me more', 'What else can you help with?']
}

/** Render inline formatting: **bold**, *italic*, `code`, [links](url), raw URLs */
function renderInline(text: string): React.ReactNode[] {
  // Regex matches: `code`, **bold**, *italic*, [text](url), or raw URLs
  const pattern = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s<]+)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[1]) {
      parts.push(<code key={match.index} className="bg-black/5 px-1 rounded text-[0.85em]">{match[1]}</code>)
    } else if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>)
    } else if (match[4] && match[5]) {
      parts.push(<a key={match.index} href={match[5]} target="_blank" rel="noopener noreferrer" className="underline text-[#9a7b5a]">{match[4]}</a>)
    } else if (match[6]) {
      parts.push(<a key={match.index} href={match[6]} target="_blank" rel="noopener noreferrer" className="underline text-[#9a7b5a]">{match[6]}</a>)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

/** Lightweight inline markdown renderer for chat messages */
export function renderMarkdown(text: string) {
  // Split into lines for block-level parsing
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-0.5 my-1">
          {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.+)/)
    const numberedMatch = line.match(/^[\s]*\d+[.)]\s+(.+)/)
    if (bulletMatch || numberedMatch) {
      listItems.push((bulletMatch || numberedMatch)![1])
    } else {
      flushList()
      if (line.trim() === '') {
        elements.push(<br key={key++} />)
      } else {
        elements.push(<span key={key++}>{renderInline(line)}{'\n'}</span>)
      }
    }
  }
  flushList()
  return elements
}

let _msgIdCounter = 0

/** Generate a stable, unique ID for each chat message. */
export function msgId(): string {
  return `msg-${++_msgIdCounter}-${Date.now()}`
}

export const CHAT_STORAGE_KEY = 'lifeboard:chat-messages'

export function loadStoredMessages(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Strip audio blob URLs (they don't survive page refresh) and keep last 50.
    // Backfill `id` for messages loaded from storage that pre-date this field.
    return parsed.slice(-50).map((m: any) => ({
      id: m.id || msgId(),
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || undefined,
      createdTask: m.createdTask || undefined,
    }))
  } catch { return [] }
}

/** Ensure every message has a stable `id` — auto-assigns one if missing. */
export function ensureIds(msgs: Message[]): Message[] {
  return msgs.map((m) => (m.id ? m : { ...m, id: msgId() }))
}

/** Clean filler phrases from assistant text to avoid phantom task creation */
export function cleanAssistantContent(raw: string): string {
  let s = raw
    .replace(/\b(all\s*set|got\s*it|no\s*problem|okay|ok|sure|done|noted)\b[.!]?\s*/ig, ' ')
    .replace(/\byou(?:'|')?ve\s+got\s+a\s+reminder(?:\s+for)?\b/ig, ' ')
    .replace(/\bi(?:'|')?ll\s+note\s+(?:that|this)(?:\s+down)?(?:\s+for\s+you)?\b[.!]?\s*/ig, ' ')
    .replace(/^\s*all\s*[.!]?\s*/i, ' ')
    .replace(/\s*[.?!]\s*/g, ' ') // collapse stray punctuation
    .replace(/\s{2,}/g, ' ')
    .trim()
  return s
}
