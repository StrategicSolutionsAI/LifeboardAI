"use client"

import { useState, useEffect, useCallback, useRef, useMemo, FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataCache } from '@/hooks/use-data-cache'
import { sanitizeEmailHtml } from '@/lib/gmail/sanitize-html'
import {
  RefreshCw,
  Mail,
  ArrowLeft,
  Paperclip,
  Loader2,
  CheckCircle,
  Search,
  X,
  Send,
  Reply,
  ReplyAll,
  Forward,
  MailOpen,
  Archive,
  Trash2,
  Plus,
  Download,
  Star,
  Tag,
  Inbox,
  SendHorizonal,
  FileText,
  UserPlus,
  Shield,
  FolderKanban,
  Sparkles,
  MailMinus,
  Undo2,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react'
import { interactive } from '@/lib/styles'
import type { ParsedEmail, AttachmentMeta } from '@/lib/gmail/message-parser'
import type { SenderGroup } from '@/app/api/email/inbox-cleaner/scan/route'

type MessageSummary = Omit<ParsedEmail, 'textBody' | 'htmlBody'>

interface MessagesResponse {
  messages: MessageSummary[]
  nextPageToken: string | null
}

interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
}

type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward'

interface ComposeState {
  mode: ComposeMode
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  inReplyTo: string
  references: string
  threadId: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match?.[1]?.trim() || from.split('@')[0]
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match?.[1] || from
}

function extractInitial(from: string): string {
  const name = extractSenderName(from)
  return (name[0] ?? '?').toUpperCase()
}

function formatEmailDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }

    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

const INITIAL_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-amber-500',
]

function getInitialColor(from: string): string {
  let hash = 0
  for (let i = 0; i < from.length; i++) {
    hash = from.charCodeAt(i) + ((hash << 5) - hash)
  }
  return INITIAL_COLORS[Math.abs(hash) % INITIAL_COLORS.length]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Not Connected State ──────────────────────────────────────────────────

function NotConnectedView() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-14 h-14 bg-theme-brand-tint rounded-2xl flex items-center justify-center">
            <Mail className="h-7 w-7 text-theme-primary" />
          </div>
          <CardTitle className="text-xl">Connect your Gmail</CardTitle>
          <CardDescription className="mt-2">
            Link your Gmail account to read and manage your inbox directly from
            LifeboardAI.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button
            onClick={() => {
              window.location.href = '/api/auth/gmail?redirectUrl=/email'
            }}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Connect Gmail
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Email List Item ──────────────────────────────────────────────────────

function EmailListItem({
  message,
  isSelected,
  isChecked,
  onClick,
  onCheck,
}: {
  message: MessageSummary
  isSelected: boolean
  isChecked: boolean
  onClick: () => void
  onCheck: () => void
}) {
  return (
    <div
      className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-theme-neutral-300/50 ${interactive.transitionFast} ${
        isSelected
          ? 'bg-theme-brand-tint'
          : isChecked
            ? 'bg-theme-brand-tint-subtle'
            : 'hover:bg-theme-surface-raised'
      }`}
    >
      <label className="flex-shrink-0 mt-1.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onCheck}
          className="h-4 w-4 rounded border-theme-neutral-300 text-theme-primary focus:ring-theme-primary/30 cursor-pointer"
        />
      </label>
      <button onClick={onClick} className="flex-1 min-w-0 text-left flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ${getInitialColor(message.from)}`}
        >
          {extractInitial(message.from)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm truncate ${
                message.isUnread
                  ? 'font-semibold text-theme-text-primary'
                  : 'font-medium text-theme-text-secondary'
              }`}
            >
              {extractSenderName(message.from)}
            </span>
            <span className="text-xs text-theme-text-tertiary flex-shrink-0">
              {formatEmailDate(message.date)}
            </span>
          </div>
          <p
            className={`text-sm truncate ${
              message.isUnread
                ? 'font-semibold text-theme-text-primary'
                : 'text-theme-text-secondary'
            }`}
          >
            {message.subject || '(no subject)'}
          </p>
          <p className="text-xs text-theme-text-tertiary truncate mt-0.5">
            {message.snippet}
          </p>
        </div>
        {message.isUnread && (
          <div className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-theme-primary" />
        )}
      </button>
    </div>
  )
}

// ── Compose Modal ────────────────────────────────────────────────────────

function ComposeModal({
  initial,
  onClose,
  onSent,
}: {
  initial: ComposeState
  onClose: () => void
  onSent: () => void
}) {
  const [to, setTo] = useState(initial.to)
  const [cc, setCc] = useState(initial.cc)
  const [bcc, setBcc] = useState(initial.bcc)
  const [subject, setSubject] = useState(initial.subject)
  const [body, setBody] = useState(initial.body)
  const [showCcBcc, setShowCcBcc] = useState(!!initial.cc || !!initial.bcc)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Draft auto-save state
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save draft after 3s of inactivity
  const saveDraft = useCallback(async () => {
    const draftBody = body
    const draftSubject = subject
    const draftTo = to
    if (!draftTo && !draftSubject && !draftBody) return

    setDraftStatus('saving')
    try {
      const payload = {
        to: draftTo.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: draftSubject.trim(),
        body: draftBody,
        inReplyTo: initial.inReplyTo || undefined,
        references: initial.references || undefined,
        threadId: initial.threadId || undefined,
        draftId: draftId || undefined,
      }

      if (draftId) {
        const res = await fetch('/api/email/drafts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) setDraftStatus('saved')
      } else {
        const res = await fetch('/api/email/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setDraftId(data.draftId)
          setDraftStatus('saved')
        }
      }
    } catch {
      setDraftStatus('idle')
    }
  }, [to, cc, bcc, subject, body, initial, draftId])

  const scheduleDraftSave = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(saveDraft, 3000)
  }, [saveDraft])

  // Trigger draft save on field changes
  useEffect(() => {
    if (to || subject || body) scheduleDraftSave()
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [to, cc, bcc, subject, body, scheduleDraftSave])

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setAttachments((prev) => [...prev, ...Array.from(files)])
    // Reset input so same file can be re-added
    e.target.value = ''
  }

  const handleFileRemove = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!to.trim() || !subject.trim()) {
      setError('To and Subject are required')
      return
    }
    setSending(true)
    setError('')

    // Cancel any pending draft save
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)

    try {
      let res: Response

      if (attachments.length > 0) {
        const formData = new FormData()
        formData.append('to', to.trim())
        if (cc.trim()) formData.append('cc', cc.trim())
        if (bcc.trim()) formData.append('bcc', bcc.trim())
        formData.append('subject', subject.trim())
        formData.append('body', body)
        if (initial.inReplyTo) formData.append('inReplyTo', initial.inReplyTo)
        if (initial.references) formData.append('references', initial.references)
        if (initial.threadId) formData.append('threadId', initial.threadId)
        if (draftId) formData.append('draftId', draftId)
        for (const file of attachments) {
          formData.append('attachments', file)
        }

        res = await fetch('/api/email/send', {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: to.trim(),
            cc: cc.trim() || undefined,
            bcc: bcc.trim() || undefined,
            subject: subject.trim(),
            body,
            inReplyTo: initial.inReplyTo || undefined,
            references: initial.references || undefined,
            threadId: initial.threadId || undefined,
            draftId: draftId || undefined,
          }),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      onSent()
    } catch (err: any) {
      setError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleDiscard = async () => {
    // Delete draft if one exists
    if (draftId) {
      try {
        await fetch(`/api/email/drafts?draftId=${draftId}`, { method: 'DELETE' })
      } catch {
        // Non-critical
      }
    }
    onClose()
  }

  const modeLabel = {
    new: 'New Message',
    reply: 'Reply',
    replyAll: 'Reply All',
    forward: 'Forward',
  }[initial.mode]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl shadow-xl flex flex-col max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-neutral-300">
          <h3 className="text-sm font-semibold text-theme-text-primary">{modeLabel}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-theme-surface-raised">
            <X className="h-4 w-4 text-theme-text-tertiary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 py-2 space-y-2 border-b border-theme-neutral-300/50">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-theme-text-tertiary w-10">To</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-theme-text-primary placeholder:text-theme-text-tertiary"
                placeholder="recipient@example.com"
                autoFocus
              />
              {!showCcBcc && (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-xs text-theme-primary hover:underline"
                >
                  Cc/Bcc
                </button>
              )}
            </div>
            {showCcBcc && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-theme-text-tertiary w-10">Cc</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    className="flex-1 text-sm bg-transparent outline-none text-theme-text-primary placeholder:text-theme-text-tertiary"
                    placeholder="cc@example.com"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-theme-text-tertiary w-10">Bcc</label>
                  <input
                    type="text"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    className="flex-1 text-sm bg-transparent outline-none text-theme-text-primary placeholder:text-theme-text-tertiary"
                    placeholder="bcc@example.com"
                  />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-theme-text-tertiary w-10">Subj</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-theme-text-primary placeholder:text-theme-text-tertiary"
                placeholder="Subject"
              />
            </div>
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 min-h-[200px] p-4 text-sm bg-transparent outline-none resize-none text-theme-text-primary placeholder:text-theme-text-tertiary"
            placeholder="Write your message..."
          />

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {attachments.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="inline-flex items-center gap-1 text-xs bg-theme-surface-raised rounded-md px-2 py-1 text-theme-text-secondary"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <span className="text-theme-text-tertiary">({formatFileSize(file.size)})</span>
                  <button
                    type="button"
                    onClick={() => handleFileRemove(i)}
                    className="ml-0.5 p-0.5 rounded hover:bg-theme-surface-alt"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-theme-neutral-300">
            <div className="flex items-center gap-2">
              {error && <p className="text-xs text-red-600">{error}</p>}
              {!error && draftStatus === 'saving' && (
                <p className="text-xs text-theme-text-tertiary">Saving draft...</p>
              )}
              {!error && draftStatus === 'saved' && (
                <p className="text-xs text-theme-text-tertiary">Draft saved</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileAdd}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Attach</span>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDiscard}>
                Discard
              </Button>
              <Button type="submit" size="sm" disabled={sending} className="gap-1.5">
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Reading Pane ─────────────────────────────────────────────────────────

function ReadingPane({
  messageId,
  onBack,
  onCompose,
  onActionDone,
  account,
}: {
  messageId: string
  onBack?: () => void
  onCompose: (state: ComposeState) => void
  onActionDone: () => void
  account?: string
}) {
  const [message, setMessage] = useState<ParsedEmail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [aiReplyLoading, setAiReplyLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/email/messages/${messageId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setMessage(data.message)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [messageId])

  // Auto-mark as read when opening
  useEffect(() => {
    if (message?.isUnread) {
      fetch(`/api/email/messages/${messageId}/modify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead' }),
      }).catch(() => {})
    }
  }, [message?.isUnread, messageId])

  // Auto-resize iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !message?.htmlBody) return

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument
        if (doc?.body) {
          iframe.style.height = `${doc.body.scrollHeight + 32}px`
        }
      } catch {
        // sandbox may block access
      }
    }

    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [message?.htmlBody])

  const handleAction = async (action: string) => {
    setActionLoading(action)
    try {
      const res = await fetch(`/api/email/messages/${messageId}/modify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Failed')

      // Update local state
      if (action === 'markRead' && message) {
        setMessage({ ...message, isUnread: false })
      } else if (action === 'markUnread' && message) {
        setMessage({ ...message, isUnread: true })
      } else if (action === 'star' && message) {
        setMessage({ ...message, labelIds: [...message.labelIds, 'STARRED'] })
      } else if (action === 'unstar' && message) {
        setMessage({ ...message, labelIds: message.labelIds.filter((l) => l !== 'STARRED') })
      }

      // Archive/trash remove from inbox — refresh list
      if (action === 'archive' || action === 'trash') {
        onActionDone()
      }
    } catch {
      // silently fail
    } finally {
      setActionLoading(null)
    }
  }

  const buildReplyState = (mode: 'reply' | 'replyAll' | 'forward'): ComposeState => {
    if (!message) {
      return { mode, to: '', cc: '', bcc: '', subject: '', body: '', inReplyTo: '', references: '', threadId: '' }
    }

    const fromEmail = extractEmail(message.from)
    const quotedDate = message.date
    const quotedFrom = message.from
    const quotedBody = message.htmlBody || message.textBody || ''
    const quote = `<br/><br/><div style="border-left: 2px solid #ccc; padding-left: 12px; color: #666;">On ${quotedDate}, ${quotedFrom} wrote:<br/>${quotedBody}</div>`

    if (mode === 'forward') {
      return {
        mode,
        to: '',
        cc: '',
        bcc: '',
        subject: message.subject.startsWith('Fwd:') ? message.subject : `Fwd: ${message.subject}`,
        body: `<br/><br/>---------- Forwarded message ----------<br/>From: ${message.from}<br/>Date: ${message.date}<br/>Subject: ${message.subject}<br/>To: ${message.to}<br/><br/>${quotedBody}`,
        inReplyTo: '',
        references: '',
        threadId: message.threadId,
      }
    }

    const replyTo = fromEmail
    const replyCc = mode === 'replyAll' ? message.cc : ''
    const replySubject = message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`

    // Build References header for threading
    const msgId = message.id // Gmail message ID, not the Message-ID header
    const refs = message.id

    return {
      mode,
      to: replyTo,
      cc: replyCc,
      bcc: '',
      subject: replySubject,
      body: quote,
      inReplyTo: refs,
      references: refs,
      threadId: message.threadId,
    }
  }

  const handleAIReply = async () => {
    if (!message) return
    setAiReplyLoading(true)
    try {
      const params = account ? `?account=${encodeURIComponent(account)}` : ''
      const res = await fetch(`/api/email/ai/reply${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // Open compose modal with AI reply prepended to the quoted original
      const replyState = buildReplyState('reply')
      replyState.body = `${data.suggestedReply}\n\n${replyState.body}`
      onCompose(replyState)
    } catch (err) {
      console.error('AI reply error:', err)
    } finally {
      setAiReplyLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
      </div>
    )
  }

  if (error || !message) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-theme-text-tertiary">
        {error || 'Failed to load message'}
      </div>
    )
  }

  const sanitizedHtml = message.htmlBody
    ? sanitizeEmailHtml(message.htmlBody)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Mobile back button */}
      {onBack && (
        <button
          onClick={onBack}
          className={`md:hidden flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-theme-primary border-b border-theme-neutral-300 ${interactive.transitionFast} hover:bg-theme-surface-raised`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inbox
        </button>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-theme-neutral-300 bg-white overflow-x-auto">
        <ActionButton
          icon={Reply}
          label="Reply"
          onClick={() => onCompose(buildReplyState('reply'))}
        />
        <ActionButton
          icon={ReplyAll}
          label="Reply All"
          onClick={() => onCompose(buildReplyState('replyAll'))}
        />
        <ActionButton
          icon={Forward}
          label="Forward"
          onClick={() => onCompose(buildReplyState('forward'))}
        />
        <div className="w-px h-5 bg-theme-neutral-300 mx-1" />
        <ActionButton
          icon={Star}
          label={message.labelIds.includes('STARRED') ? 'Unstar' : 'Star'}
          loading={actionLoading === 'star' || actionLoading === 'unstar'}
          onClick={() => handleAction(message.labelIds.includes('STARRED') ? 'unstar' : 'star')}
        />
        <ActionButton
          icon={message.isUnread ? MailOpen : Mail}
          label={message.isUnread ? 'Mark read' : 'Mark unread'}
          loading={actionLoading === 'markRead' || actionLoading === 'markUnread'}
          onClick={() => handleAction(message.isUnread ? 'markRead' : 'markUnread')}
        />
        <ActionButton
          icon={Archive}
          label="Archive"
          loading={actionLoading === 'archive'}
          onClick={() => handleAction('archive')}
        />
        <ActionButton
          icon={Trash2}
          label="Delete"
          loading={actionLoading === 'trash'}
          onClick={() => handleAction('trash')}
        />
        <div className="w-px h-5 bg-theme-neutral-300 mx-1" />
        <ActionButton
          icon={Sparkles}
          label="AI Reply"
          loading={aiReplyLoading}
          onClick={handleAIReply}
        />
      </div>

      {/* Headers */}
      <div className="px-4 md:px-6 py-4 border-b border-theme-neutral-300 space-y-1.5">
        <h2 className="text-lg font-semibold text-theme-text-primary leading-tight">
          {message.subject || '(no subject)'}
        </h2>
        <div className="text-sm text-theme-text-secondary">
          <span className="font-medium">From:</span> {message.from}
        </div>
        <div className="text-sm text-theme-text-tertiary">
          <span className="font-medium text-theme-text-secondary">To:</span>{' '}
          {message.to}
        </div>
        {message.cc && (
          <div className="text-sm text-theme-text-tertiary">
            <span className="font-medium text-theme-text-secondary">Cc:</span>{' '}
            {message.cc}
          </div>
        )}
        <div className="text-xs text-theme-text-tertiary">{message.date}</div>

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Paperclip className="h-3.5 w-3.5 text-theme-text-tertiary" />
            {message.attachments.map((att: AttachmentMeta, i: number) => (
              <a
                key={i}
                href={`/api/email/messages/${messageId}/attachments/${att.attachmentId}?filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`}
                download={att.filename}
                className="inline-flex items-center gap-1 text-xs text-theme-primary bg-theme-brand-tint-subtle rounded px-1.5 py-0.5 hover:bg-theme-brand-tint"
              >
                <Download className="h-3 w-3" />
                {att.filename}
                <span className="text-theme-text-tertiary">({formatFileSize(att.size)})</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {sanitizedHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={sanitizedHtml}
            sandbox=""
            className="w-full min-h-[300px] border-0"
            title="Email content"
          />
        ) : (
          <pre className="px-4 md:px-6 py-4 text-sm text-theme-text-primary whitespace-pre-wrap font-sans leading-relaxed">
            {message.textBody || '(no content)'}
          </pre>
        )}
      </div>
    </div>
  )
}

// ── Action Button ────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  onClick,
  loading,
}: {
  icon: typeof Reply
  label: string
  onClick: () => void
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-theme-text-secondary hover:bg-theme-surface-raised hover:text-theme-text-primary ${interactive.transitionFast} disabled:opacity-50`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────

function EmptyReadingPane() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-theme-text-tertiary gap-2">
      <Mail className="h-10 w-10 opacity-30" />
      <p className="text-sm">Select an email to read</p>
    </div>
  )
}

// ── Inbox Cleaner Modal ──────────────────────────────────────────────────

type SortOption = 'count' | 'newest' | 'oldest'
type CleanerFilter = 'active' | 'unsubscribed' | 'kept'

interface InboxCleanerState {
  scanState: 'idle' | 'scanning' | 'done' | 'error'
  senders: SenderGroup[]
  totalPromotional: number
  keptSenders: Set<string>
  unsubscribedSenders: Set<string>
  deleteForSender: Set<string>
  scanError: string
}

// Lifted state so scan results persist across modal open/close
const inboxCleanerCache: { current: InboxCleanerState | null; account: string | undefined } = {
  current: null,
  account: undefined,
}

function InboxCleanerModal({
  onClose,
  account,
}: {
  onClose: () => void
  account?: string
}) {
  // Restore from cache if same account, otherwise fresh state
  const cached = inboxCleanerCache.account === account ? inboxCleanerCache.current : null

  const [scanState, setScanState] = useState<InboxCleanerState['scanState']>(cached?.scanState ?? 'idle')
  const [senders, setSenders] = useState<SenderGroup[]>(cached?.senders ?? [])
  const [totalPromotional, setTotalPromotional] = useState(cached?.totalPromotional ?? 0)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('count')
  const [filter, setFilter] = useState<CleanerFilter>('active')
  const [keptSenders, setKeptSenders] = useState<Set<string>>(cached?.keptSenders ?? new Set())
  const [unsubscribedSenders, setUnsubscribedSenders] = useState<Set<string>>(cached?.unsubscribedSenders ?? new Set())
  const [unsubscribingFrom, setUnsubscribingFrom] = useState<string | null>(null)
  const [deleteForSender, setDeleteForSender] = useState<Set<string>>(cached?.deleteForSender ?? new Set())
  const [scanError, setScanError] = useState(cached?.scanError ?? '')
  const [errorSenders, setErrorSenders] = useState<Map<string, string>>(new Map())
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState<{ total: number; done: number } | null>(null)
  const [confirmSender, setConfirmSender] = useState<SenderGroup | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [undoQueue, setUndoQueue] = useState<{ email: string; type: 'kept' | 'unsubscribed' }[]>([])
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Persist state to cache on every change
  useEffect(() => {
    inboxCleanerCache.current = {
      scanState, senders, totalPromotional, keptSenders,
      unsubscribedSenders, deleteForSender, scanError,
    }
    inboxCleanerCache.account = account
  }, [scanState, senders, totalPromotional, keptSenders, unsubscribedSenders, deleteForSender, scanError, account])

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmBulk) setConfirmBulk(false)
        else if (confirmSender) setConfirmSender(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, confirmSender, confirmBulk])

  // Focus trap — keep focus inside modal
  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  // Scan on mount (skip if cached results exist)
  const runScan = useCallback(async () => {
    setScanState('scanning')
    setScanError('')
    try {
      const params = account ? `?account=${encodeURIComponent(account)}` : ''
      const res = await fetch(`/api/email/inbox-cleaner/scan${params}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSenders(data.senders)
      setTotalPromotional(data.totalPromotionalEmails)
      setScanState('done')
    } catch (err: any) {
      setScanError(err.message || 'Failed to scan')
      setScanState('error')
    }
  }, [account])

  useEffect(() => {
    if (!cached || cached.scanState !== 'done') {
      runScan()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Undo timer — auto-clear after 5s
  useEffect(() => {
    if (undoQueue.length > 0) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      undoTimerRef.current = setTimeout(() => setUndoQueue([]), 5000)
    }
    return () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }
  }, [undoQueue])

  const handleUnsubscribe = useCallback(async (sender: SenderGroup) => {
    const willDelete = deleteForSender.has(sender.senderEmail)

    // If delete toggle is on, require confirmation
    if (willDelete && confirmSender?.senderEmail !== sender.senderEmail) {
      setConfirmSender(sender)
      return
    }
    setConfirmSender(null)

    setUnsubscribingFrom(sender.senderEmail)
    setErrorSenders((prev) => { const next = new Map(prev); next.delete(sender.senderEmail); return next })
    try {
      const params = account ? `?account=${encodeURIComponent(account)}` : ''
      const res = await fetch(`/api/email/inbox-cleaner/unsubscribe${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: sender.senderEmail,
          unsubscribeUrl: sender.unsubscribeUrl,
          unsubscribeMailto: sender.unsubscribeMailto,
          hasOneClick: sender.hasOneClick,
          deleteEmails: willDelete,
        }),
      })

      if (res.status === 429) {
        setErrorSenders((prev) => new Map(prev).set(sender.senderEmail, 'Rate limited — wait a moment'))
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      if (data.success) {
        setUnsubscribedSenders((prev) => new Set(prev).add(sender.senderEmail))
        setUndoQueue((prev) => [...prev, { email: sender.senderEmail, type: 'unsubscribed' }])
      } else {
        setErrorSenders((prev) => new Map(prev).set(sender.senderEmail, data.error || 'Could not unsubscribe'))
      }
    } catch (err: any) {
      setErrorSenders((prev) => new Map(prev).set(sender.senderEmail, err.message || 'Network error'))
    } finally {
      setUnsubscribingFrom(null)
    }
  }, [account, deleteForSender, confirmSender])

  const handleKeep = useCallback((senderEmail: string) => {
    setKeptSenders((prev) => new Set(prev).add(senderEmail))
    setUndoQueue((prev) => [...prev, { email: senderEmail, type: 'kept' }])
  }, [])

  const handleUndo = useCallback((email: string, type: 'kept' | 'unsubscribed') => {
    if (type === 'kept') {
      setKeptSenders((prev) => { const next = new Set(prev); next.delete(email); return next })
    } else {
      setUnsubscribedSenders((prev) => { const next = new Set(prev); next.delete(email); return next })
    }
    setUndoQueue((prev) => prev.filter((u) => u.email !== email))
  }, [])

  const handleToggleSelect = useCallback((email: string) => {
    setSelectedSenders((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }, [])

  const filteredSenders = useMemo(() => {
    let result: SenderGroup[]

    switch (filter) {
      case 'unsubscribed':
        result = senders.filter((s) => unsubscribedSenders.has(s.senderEmail))
        break
      case 'kept':
        result = senders.filter((s) => keptSenders.has(s.senderEmail))
        break
      default:
        result = senders.filter(
          (s) => !keptSenders.has(s.senderEmail) && !unsubscribedSenders.has(s.senderEmail),
        )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.senderName.toLowerCase().includes(q) ||
          s.senderEmail.toLowerCase().includes(q),
      )
    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.lastSeenDate).getTime() - new Date(a.lastSeenDate).getTime())
        break
      case 'oldest':
        result.sort((a, b) => new Date(a.lastSeenDate).getTime() - new Date(b.lastSeenDate).getTime())
        break
      default:
        result.sort((a, b) => b.emailCount - a.emailCount)
    }

    return result
  }, [senders, keptSenders, unsubscribedSenders, searchQuery, sortBy, filter])

  const hasUnsubscribeMethod = (s: SenderGroup) =>
    !!(s.unsubscribeUrl || s.unsubscribeMailto)

  const handleSelectAll = useCallback(() => {
    const activeEmails = filteredSenders.map((s) => s.senderEmail)
    const allSelected = activeEmails.length > 0 && activeEmails.every((e) => selectedSenders.has(e))
    if (allSelected) {
      setSelectedSenders(new Set())
    } else {
      setSelectedSenders(new Set(activeEmails))
    }
  }, [filteredSenders, selectedSenders])

  const handleBulkUnsubscribe = useCallback(async () => {
    const selectedArr = Array.from(selectedSenders)
    const selectedWithDelete = selectedArr.some((e) => deleteForSender.has(e))
    if (selectedWithDelete && !confirmBulk) {
      setConfirmBulk(true)
      return
    }
    setConfirmBulk(false)

    const toProcess = senders.filter((s) => selectedSenders.has(s.senderEmail))
    setBulkProcessing({ total: toProcess.length, done: 0 })

    for (let i = 0; i < toProcess.length; i++) {
      const sender = toProcess[i]
      const willDelete = deleteForSender.has(sender.senderEmail)
      try {
        const params = account ? `?account=${encodeURIComponent(account)}` : ''
        const res = await fetch(`/api/email/inbox-cleaner/unsubscribe${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderEmail: sender.senderEmail,
            unsubscribeUrl: sender.unsubscribeUrl,
            unsubscribeMailto: sender.unsubscribeMailto,
            hasOneClick: sender.hasOneClick,
            deleteEmails: willDelete,
          }),
        })

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000))
          i--
          continue
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        if (data.success) {
          setUnsubscribedSenders((prev) => new Set(prev).add(sender.senderEmail))
        } else {
          setErrorSenders((prev) => new Map(prev).set(sender.senderEmail, data.error || 'Failed'))
        }
      } catch (err: any) {
        setErrorSenders((prev) => new Map(prev).set(sender.senderEmail, err.message || 'Error'))
      }
      setBulkProcessing({ total: toProcess.length, done: i + 1 })
    }

    setSelectedSenders(new Set())
    setBulkProcessing(null)
  }, [selectedSenders, senders, deleteForSender, account, confirmBulk])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-cleaner-title"
        tabIndex={-1}
        className="bg-theme-surface-base w-full max-w-3xl rounded-xl shadow-xl flex flex-col max-h-[85dvh] mx-4 outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-neutral-300">
          <div className="flex items-center gap-2.5">
            <MailMinus className="h-5 w-5 text-theme-primary" />
            <h3 id="inbox-cleaner-title" className="text-base font-semibold text-theme-text-primary">Inbox Cleaner</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-theme-surface-raised min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="h-4 w-4 text-theme-text-tertiary" />
          </button>
        </div>

        {/* Loading state */}
        {scanState === 'scanning' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-theme-primary" />
            <p className="text-sm text-theme-text-secondary">Scanning promotional emails...</p>
            <p className="text-xs text-theme-text-tertiary">This may take a moment</p>
          </div>
        )}

        {/* Error state */}
        {scanState === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-theme-text-secondary">Failed to scan emails</p>
            <p className="text-xs text-red-500">{scanError}</p>
            <Button variant="outline" size="sm" onClick={runScan} className="mt-2 gap-1.5">
              <RefreshCcw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        )}

        {/* Results */}
        {scanState === 'done' && (
          <>
            {/* Summary bar */}
            <div className="px-5 py-3 border-b border-theme-neutral-300 bg-theme-surface-raised/50">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-theme-text-secondary">
                  <span className="font-semibold text-theme-text-primary">{senders.length}</span>
                  {' '}sender{senders.length !== 1 ? 's' : ''} sending you promotions
                  <span className="text-xs ml-2 text-theme-text-tertiary">
                    ({totalPromotional} emails scanned)
                  </span>
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setFilter('active')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      filter === 'active'
                        ? 'bg-theme-primary/10 text-theme-primary font-medium'
                        : 'text-theme-text-tertiary hover:text-theme-text-secondary'
                    }`}
                  >
                    Active ({senders.length - keptSenders.size - unsubscribedSenders.size})
                  </button>
                  {unsubscribedSenders.size > 0 && (
                    <button
                      onClick={() => setFilter('unsubscribed')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        filter === 'unsubscribed'
                          ? 'bg-red-50 text-red-600 font-medium'
                          : 'text-red-500 hover:text-red-600'
                      }`}
                    >
                      {unsubscribedSenders.size} unsubscribed
                    </button>
                  )}
                  {keptSenders.size > 0 && (
                    <button
                      onClick={() => setFilter('kept')}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        filter === 'kept'
                          ? 'bg-green-50 text-green-600 font-medium'
                          : 'text-green-500 hover:text-green-600'
                      }`}
                    >
                      {keptSenders.size} kept
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-theme-neutral-300">
              {filter === 'active' && (
                <label className="flex-shrink-0 cursor-pointer" title="Select all">
                  <input
                    type="checkbox"
                    checked={filteredSenders.length > 0 && filteredSenders.every((s) => selectedSenders.has(s.senderEmail))}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-theme-neutral-300 text-theme-primary focus:ring-theme-primary/30 cursor-pointer"
                  />
                </label>
              )}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-text-tertiary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search senders..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-theme-neutral-300 bg-theme-surface-base outline-none focus:border-theme-primary/50 focus:ring-1 focus:ring-theme-primary/20 text-theme-text-primary placeholder:text-theme-text-tertiary"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-xs border border-theme-neutral-300 rounded-md px-2 py-1.5 bg-theme-surface-base text-theme-text-secondary outline-none focus:border-theme-primary/50"
              >
                <option value="count">Most emails</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
              {filter === 'active' && (
                <Button variant="ghost" size="sm" onClick={runScan} className="ml-auto text-xs gap-1 text-theme-text-tertiary" title="Re-scan">
                  <RefreshCcw className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Bulk action bar */}
            {selectedSenders.size > 0 && filter === 'active' && !bulkProcessing && (
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-theme-neutral-300 bg-theme-brand-tint-subtle">
                <span className="text-xs font-medium text-theme-text-primary">
                  {selectedSenders.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const emails = Array.from(selectedSenders)
                    setKeptSenders((prev) => {
                      const next = new Set(prev)
                      emails.forEach((e) => next.add(e))
                      return next
                    })
                    setSelectedSenders(new Set())
                  }}
                  className="text-xs h-7"
                >
                  Keep All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const emails = Array.from(selectedSenders)
                    setDeleteForSender((prev) => {
                      const next = new Set(prev)
                      emails.forEach((e) => next.add(e))
                      return next
                    })
                  }}
                  className="text-xs h-7 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  title="Toggle delete for all selected senders"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete All Emails
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUnsubscribe()}
                  className="text-xs h-7 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <MailMinus className="h-3 w-3" />
                  Unsubscribe All
                </Button>
                <button
                  onClick={() => setSelectedSenders(new Set())}
                  className="ml-auto text-xs text-theme-text-tertiary hover:text-theme-text-secondary"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Bulk processing progress */}
            {bulkProcessing && (
              <div className="flex items-center gap-2 px-5 py-2.5 border-b border-theme-neutral-300 bg-theme-surface-raised">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-theme-primary flex-shrink-0" />
                <span className="text-xs text-theme-text-secondary">
                  Unsubscribing... {bulkProcessing.done} / {bulkProcessing.total}
                </span>
                <div className="flex-1 h-1.5 bg-theme-neutral-300 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-theme-primary rounded-full transition-all"
                    style={{ width: `${(bulkProcessing.done / bulkProcessing.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bulk confirm dialog */}
            {confirmBulk && (
              <div className="px-5 py-3 border-b border-red-200 bg-red-50 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-800 flex-1">
                  Unsubscribe from <span className="font-semibold">{selectedSenders.size}</span> sender{selectedSenders.size !== 1 ? 's' : ''} and delete their emails?
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setConfirmBulk(false)} className="text-xs h-7">
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkUnsubscribe()}
                    className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Confirm
                  </Button>
                </div>
              </div>
            )}

            {/* Undo toast */}
            {undoQueue.length > 0 && (
              <div className="px-5 py-2 border-b border-theme-neutral-300 bg-theme-surface-raised flex items-center gap-2 text-xs">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                <span className="text-theme-text-secondary flex-1">
                  {undoQueue[undoQueue.length - 1].type === 'kept' ? 'Kept' : 'Unsubscribed from'}{' '}
                  <span className="font-medium text-theme-text-primary">
                    {extractSenderName(
                      senders.find((s) => s.senderEmail === undoQueue[undoQueue.length - 1].email)?.senderName
                      || undoQueue[undoQueue.length - 1].email
                    )}
                  </span>
                </span>
                <button
                  onClick={() => {
                    const last = undoQueue[undoQueue.length - 1]
                    handleUndo(last.email, last.type)
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-theme-primary hover:bg-theme-primary/10 font-medium"
                >
                  <Undo2 className="h-3 w-3" />
                  Undo
                </button>
              </div>
            )}

            {/* Confirmation banner */}
            {confirmSender && (
              <div className="px-5 py-3 border-b border-red-200 bg-red-50 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-800 flex-1">
                  Unsubscribe from <span className="font-semibold">{confirmSender.senderName}</span> and delete{' '}
                  <span className="font-semibold">{confirmSender.emailCount}</span> email{confirmSender.emailCount !== 1 ? 's' : ''}?
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmSender(null)}
                    className="text-xs h-7"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnsubscribe(confirmSender)}
                    className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Confirm
                  </Button>
                </div>
              </div>
            )}

            {/* Sender list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {filteredSenders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Mail className="h-8 w-8 opacity-20 text-theme-text-tertiary" />
                  <p className="text-sm text-theme-text-tertiary">
                    {senders.length === 0
                      ? 'No promotional senders found — your inbox is clean!'
                      : filter !== 'active'
                        ? `No ${filter} senders yet`
                        : 'No senders match your search'}
                  </p>
                  {senders.length === 0 && (
                    <p className="text-xs text-theme-text-tertiary">
                      Scanned {totalPromotional} emails in the Promotions category.
                    </p>
                  )}
                </div>
              ) : (
                filteredSenders.map((sender) => {
                  const isUnsubscribing = unsubscribingFrom === sender.senderEmail
                  const canUnsubscribe = hasUnsubscribeMethod(sender)
                  const senderError = errorSenders.get(sender.senderEmail)
                  const isKept = keptSenders.has(sender.senderEmail)
                  const isUnsubscribed = unsubscribedSenders.has(sender.senderEmail)
                  const willDelete = deleteForSender.has(sender.senderEmail)

                  return (
                    <div
                      key={sender.senderEmail}
                      className={`flex items-center gap-3 px-5 py-3 border-b border-theme-neutral-300/50 transition-colors ${
                        isKept || isUnsubscribed ? 'opacity-60'
                          : selectedSenders.has(sender.senderEmail) ? 'bg-theme-brand-tint-subtle'
                          : 'hover:bg-theme-surface-raised'
                      }`}
                    >
                      {/* Checkbox */}
                      {filter === 'active' && (
                        <label className="flex-shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSenders.has(sender.senderEmail)}
                            onChange={() => handleToggleSelect(sender.senderEmail)}
                            className="h-4 w-4 rounded border-theme-neutral-300 text-theme-primary focus:ring-theme-primary/30 cursor-pointer"
                          />
                        </label>
                      )}

                      {/* Avatar */}
                      <div
                        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ${getInitialColor(sender.senderEmail)}`}
                      >
                        {(sender.senderName[0] ?? '?').toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-theme-text-primary truncate">
                            {sender.senderName}
                          </span>
                          <span className="text-xs text-theme-text-tertiary truncate hidden sm:inline">
                            {sender.senderEmail}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-theme-text-secondary">
                            {sender.emailCount} email{sender.emailCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-theme-text-tertiary">
                            &middot; Last: {formatEmailDate(sender.lastSeenDate)}
                          </span>
                          {senderError && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {senderError}
                            </span>
                          )}
                          {isUnsubscribed && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Unsubscribed
                            </span>
                          )}
                          {isKept && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Kept
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions — only show for active filter */}
                      {filter === 'active' && (
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                          {/* Per-sender delete toggle */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Also delete all emails from this sender">
                            <Trash2 className={`h-3 w-3 ${willDelete ? 'text-red-500' : 'text-theme-text-tertiary'}`} />
                            <button
                              type="button"
                              role="switch"
                              aria-checked={willDelete}
                              aria-label={`Delete emails from ${sender.senderName}`}
                              onClick={() => setDeleteForSender((prev) => {
                                const next = new Set(prev)
                                if (next.has(sender.senderEmail)) {
                                  next.delete(sender.senderEmail)
                                } else {
                                  next.add(sender.senderEmail)
                                }
                                return next
                              })}
                              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                                willDelete ? 'bg-red-500' : 'bg-theme-neutral-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                                  willDelete ? 'translate-x-[14px]' : 'translate-x-[2px]'
                                }`}
                              />
                            </button>
                          </label>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleKeep(sender.senderEmail)}
                            className="text-xs h-8"
                          >
                            Keep
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnsubscribe(sender)}
                            disabled={(!canUnsubscribe && !willDelete) || isUnsubscribing}
                            className={`text-xs h-8 ${
                              canUnsubscribe || willDelete
                                ? 'text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700'
                                : ''
                            }`}
                            title={
                              !canUnsubscribe && !willDelete
                                ? 'No unsubscribe method available'
                                : willDelete
                                  ? `Unsubscribe & delete ${sender.emailCount} email${sender.emailCount !== 1 ? 's' : ''}`
                                  : 'Unsubscribe from sender'
                            }
                          >
                            {isUnsubscribing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : willDelete ? (
                              <>
                                <Trash2 className="h-3 w-3 mr-1" />
                                Unsubscribe
                              </>
                            ) : (
                              'Unsubscribe'
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Undo button for kept/unsubscribed views */}
                      {filter !== 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUndo(sender.senderEmail, isKept ? 'kept' : 'unsubscribed')}
                          className="text-xs h-8 gap-1 text-theme-text-tertiary"
                        >
                          <Undo2 className="h-3 w-3" />
                          Undo
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export default function EmailPageClient() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [showMobileReading, setShowMobileReading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [composeState, setComposeState] = useState<ComposeState | null>(null)
  const [allMessages, setAllMessages] = useState<MessageSummary[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [labels, setLabels] = useState<GmailLabel[]>([])
  const [activeLabel, setActiveLabel] = useState('INBOX')
  const [accounts, setAccounts] = useState<string[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gmail-selected-account') || ''
    }
    return ''
  })

  // Multi-select state
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // AI agent state
  const [spamFilterState, setSpamFilterState] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [spamResults, setSpamResults] = useState<{ totalChecked: number; movedCount: number } | null>(null)
  const [organizeState, setOrganizeState] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [organizeResults, setOrganizeResults] = useState<{ totalOrganized: number; categorySummary: Record<string, number> } | null>(null)
  const [showInboxCleaner, setShowInboxCleaner] = useState(false)

  // Check connection status
  useEffect(() => {
    fetch('/api/integrations/status?provider=gmail')
      .then((res) => res.json())
      .then((data) => setIsConnected(data.connected === true))
      .catch(() => setIsConnected(false))
  }, [])

  // Fetch connected accounts on mount
  useEffect(() => {
    if (!isConnected) return
    fetch('/api/email/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) {
          setAccounts(data.accounts)
          // If no account selected, default to first
          if (!selectedAccount && data.accounts.length > 0) {
            setSelectedAccount(data.accounts[0])
          }
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  // Build account query param string for API calls
  const accountParam = selectedAccount ? `&account=${encodeURIComponent(selectedAccount)}` : ''

  // Fetch labels on mount
  useEffect(() => {
    if (!isConnected) return
    fetch(`/api/email/labels?${selectedAccount ? `account=${encodeURIComponent(selectedAccount)}` : ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.labels) setLabels(data.labels)
      })
      .catch(() => {})
  }, [isConnected, selectedAccount])

  // Map active label to Gmail query
  const labelQuery = (() => {
    switch (activeLabel) {
      case 'INBOX': return 'in:inbox'
      case 'SENT': return 'in:sent'
      case 'STARRED': return 'is:starred'
      case 'DRAFT': return 'in:drafts'
      case 'SPAM': return 'in:spam'
      case 'TRASH': return 'in:trash'
      default: return `label:${activeLabel}`
    }
  })()

  const fetchMessages = useCallback(async (): Promise<MessagesResponse> => {
    const params = new URLSearchParams({ maxResults: '30' })
    const q = activeQuery || labelQuery
    params.set('q', q)
    if (selectedAccount) params.set('account', selectedAccount)
    const res = await fetch(`/api/email/messages?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }, [activeQuery, labelQuery, selectedAccount])

  const {
    data: messagesData,
    loading: messagesLoading,
    error: messagesError,
    refetch,
  } = useDataCache<MessagesResponse>(`gmail-messages-${selectedAccount}-${activeLabel}-${activeQuery}`, fetchMessages, {
    ttl: 60_000,
  })

  // Sync cache data into allMessages
  useEffect(() => {
    if (messagesData) {
      setAllMessages(messagesData.messages)
      setNextPageToken(messagesData.nextPageToken)
    }
  }, [messagesData])

  const handleLabelChange = useCallback((labelId: string) => {
    setActiveLabel(labelId)
    setSelectedMessageId(null)
    setShowMobileReading(false)
  }, [])

  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({ maxResults: '30', pageToken: nextPageToken })
      const q = activeQuery || labelQuery
      params.set('q', q)
      if (selectedAccount) params.set('account', selectedAccount)
      const res = await fetch(`/api/email/messages?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: MessagesResponse = await res.json()
      setAllMessages((prev) => [...prev, ...data.messages])
      setNextPageToken(data.nextPageToken)
    } catch (err) {
      console.error('Failed to load more emails:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [nextPageToken, loadingMore, activeQuery, labelQuery, selectedAccount])

  const messages = allMessages

  const handleSelectMessage = useCallback((id: string) => {
    setSelectedMessageId(id)
    setShowMobileReading(true)
  }, [])

  const handleMobileBack = useCallback(() => {
    setShowMobileReading(false)
  }, [])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setActiveQuery(searchQuery.trim())
    setSelectedMessageId(null)
  }

  const handleAccountSwitch = useCallback((acct: string) => {
    setSelectedAccount(acct)
    localStorage.setItem('gmail-selected-account', acct)
    setSelectedMessageId(null)
    setShowMobileReading(false)
  }, [])

  const handleClearSearch = () => {
    setSearchQuery('')
    setActiveQuery('')
    setSelectedMessageId(null)
  }

  const handleCompose = (state: ComposeState) => {
    setComposeState(state)
  }

  const handleNewCompose = () => {
    setComposeState({
      mode: 'new',
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
      inReplyTo: '',
      references: '',
      threadId: '',
    })
  }

  const handleSent = () => {
    setComposeState(null)
    refetch()
  }

  const handleActionDone = () => {
    setSelectedMessageId(null)
    setShowMobileReading(false)
    refetch()
  }

  const handleToggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (checkedIds.size === messages.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(messages.map((m) => m.id)))
    }
  }, [checkedIds.size, messages])

  const handleBulkDelete = useCallback(async () => {
    if (checkedIds.size === 0) return
    setBulkDeleting(true)
    const accountParam = selectedAccount ? `?account=${encodeURIComponent(selectedAccount)}` : ''
    try {
      await Promise.all(
        Array.from(checkedIds).map((id) =>
          fetch(`/api/email/messages/${id}/modify${accountParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'trash' }),
          }),
        ),
      )
      setCheckedIds(new Set())
      setSelectedMessageId(null)
      setShowMobileReading(false)
      refetch()
    } catch (err) {
      console.error('Bulk delete error:', err)
    } finally {
      setBulkDeleting(false)
    }
  }, [checkedIds, selectedAccount, refetch])

  // Clear checked IDs when messages change (label switch, search, etc.)
  useEffect(() => {
    setCheckedIds(new Set())
  }, [activeLabel, activeQuery, selectedAccount])

  const refreshLabels = useCallback(() => {
    fetch(`/api/email/labels?${selectedAccount ? `account=${encodeURIComponent(selectedAccount)}` : ''}`)
      .then((res) => res.json())
      .then((data) => { if (data.labels) setLabels(data.labels) })
      .catch(() => {})
  }, [selectedAccount])

  const handleSpamFilter = useCallback(async () => {
    setSpamFilterState('scanning')
    setSpamResults(null)
    try {
      const ids = allMessages.map((m) => m.id)
      const params = selectedAccount ? `?account=${encodeURIComponent(selectedAccount)}` : ''
      const res = await fetch(`/api/email/ai/spam${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: ids }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSpamResults({ totalChecked: data.totalChecked, movedCount: data.movedCount })
      if (data.movedCount > 0) {
        refetch()
        refreshLabels()
      }
    } catch (err) {
      console.error('Spam filter error:', err)
    } finally {
      setSpamFilterState('done')
    }
  }, [allMessages, selectedAccount, refetch, refreshLabels])

  const handleOrganize = useCallback(async () => {
    setOrganizeState('scanning')
    setOrganizeResults(null)
    try {
      const ids = allMessages.map((m) => m.id)
      const params = selectedAccount ? `?account=${encodeURIComponent(selectedAccount)}` : ''
      const res = await fetch(`/api/email/ai/organize${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: ids }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setOrganizeResults({ totalOrganized: data.totalOrganized, categorySummary: data.categorySummary })
      if (data.totalOrganized > 0) {
        refreshLabels()
      }
    } catch (err) {
      console.error('Organize error:', err)
    } finally {
      setOrganizeState('done')
    }
  }, [allMessages, selectedAccount, refreshLabels])

  // Loading connection check
  if (isConnected === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-theme-text-tertiary" />
      </div>
    )
  }

  if (!isConnected) {
    return <NotConnectedView />
  }

  return (
    <>
      <div className="flex flex-col h-[calc(100dvh-160px)] md:h-[calc(100dvh-140px)] -mx-6 sm:-mx-8 md:-mx-10 -mt-4 sm:-mt-6 md:-mt-8">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-theme-neutral-300 bg-white/80 backdrop-blur-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewCompose}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={messagesLoading}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${messagesLoading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSpamFilter}
            disabled={spamFilterState === 'scanning' || allMessages.length === 0}
            className="gap-1.5"
            title="AI spam detection"
          >
            {spamFilterState === 'scanning' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Filter Spam</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOrganize}
            disabled={organizeState === 'scanning' || allMessages.length === 0}
            className="gap-1.5"
            title="AI email organization"
          >
            {organizeState === 'scanning' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderKanban className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Organize</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInboxCleaner(true)}
            className="gap-1.5"
            title="Scan promotional senders & unsubscribe"
          >
            <MailMinus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clean Up</span>
          </Button>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md ml-auto flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails..."
                className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-theme-neutral-300 bg-white outline-none focus:border-theme-primary/50 focus:ring-1 focus:ring-theme-primary/20 text-theme-text-primary placeholder:text-theme-text-tertiary"
              />
              {(searchQuery || activeQuery) && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-theme-surface-raised"
                >
                  <X className="h-3 w-3 text-theme-text-tertiary" />
                </button>
              )}
            </div>
          </form>

          {/* Account selector */}
          {accounts.length > 1 && (
            <select
              value={selectedAccount}
              onChange={(e) => handleAccountSwitch(e.target.value)}
              className="text-xs border border-theme-neutral-300 rounded-md px-2 py-1 bg-white text-theme-text-secondary outline-none focus:border-theme-primary/50 flex-shrink-0"
            >
              {accounts.map((acct) => (
                <option key={acct} value={acct}>{acct}</option>
              ))}
            </select>
          )}

          {/* Add account button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.href = '/api/auth/gmail?redirectUrl=/email'
            }}
            className="gap-1 text-xs flex-shrink-0"
            title="Add another Gmail account"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Add account</span>
          </Button>

          <div className="flex items-center gap-1.5 text-xs text-theme-text-tertiary flex-shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            <span className="hidden sm:inline">{accounts.length <= 1 ? 'Connected' : ''}</span>
          </div>
        </div>

        {/* Label tabs */}
        {!activeQuery && labels.length > 0 && (
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-theme-neutral-300 bg-white overflow-x-auto">
            {labels.map((label) => {
              const icon = {
                INBOX: Inbox,
                STARRED: Star,
                SENT: SendHorizonal,
                DRAFT: FileText,
                SPAM: Mail,
                TRASH: Trash2,
              }[label.id] ?? Tag
              const LabelIcon = icon
              return (
                <button
                  key={label.id}
                  onClick={() => handleLabelChange(label.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${interactive.transitionFast} ${
                    activeLabel === label.id
                      ? 'bg-theme-brand-tint text-theme-primary'
                      : 'text-theme-text-secondary hover:bg-theme-surface-raised hover:text-theme-text-primary'
                  }`}
                >
                  <LabelIcon className="h-3.5 w-3.5" />
                  {label.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Active search indicator */}
        {activeQuery && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-theme-text-secondary bg-theme-brand-tint-subtle border-b border-theme-neutral-300/50">
            <Search className="h-3 w-3" />
            Results for &ldquo;{activeQuery}&rdquo;
            <button
              onClick={handleClearSearch}
              className="ml-auto text-theme-primary hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* AI agent result banners */}
        {spamFilterState === 'scanning' && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-theme-text-secondary bg-amber-50 border-b border-amber-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
            Scanning emails for spam...
          </div>
        )}
        {spamResults && spamFilterState === 'done' && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs bg-green-50 border-b border-green-200">
            <Shield className="h-3.5 w-3.5 text-green-600" />
            <span className="text-green-800">
              Scanned {spamResults.totalChecked} emails. Moved {spamResults.movedCount} to Spam Review.
            </span>
            <button
              onClick={() => { setSpamResults(null); setSpamFilterState('idle') }}
              className="ml-auto p-0.5 rounded hover:bg-green-100"
            >
              <X className="h-3 w-3 text-green-600" />
            </button>
          </div>
        )}
        {organizeState === 'scanning' && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-theme-text-secondary bg-blue-50 border-b border-blue-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            Organizing emails...
          </div>
        )}
        {organizeResults && organizeState === 'done' && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs bg-blue-50 border-b border-blue-200">
            <FolderKanban className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-blue-800">
              Organized {organizeResults.totalOrganized} emails
              {Object.keys(organizeResults.categorySummary).length > 0 && (
                <>: {Object.entries(organizeResults.categorySummary).map(([cat, count], i) => (
                  <span key={cat}>{i > 0 ? ', ' : ''}{cat} ({count})</span>
                ))}</>
              )}
            </span>
            <button
              onClick={() => { setOrganizeResults(null); setOrganizeState('idle') }}
              className="ml-auto p-0.5 rounded hover:bg-blue-100"
            >
              <X className="h-3 w-3 text-blue-600" />
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="flex flex-1 min-h-0">
          {/* Email list */}
          <div
            className={`${
              showMobileReading ? 'hidden md:flex' : 'flex'
            } w-full md:w-[380px] flex-col border-r border-theme-neutral-300 bg-white`}
          >
            {/* Bulk action bar */}
            {checkedIds.size > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-theme-neutral-300 bg-theme-surface-raised">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedIds.size === messages.length && messages.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-theme-neutral-300 text-theme-primary focus:ring-theme-primary/30 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-theme-text-secondary">
                    {checkedIds.size} selected
                  </span>
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="ml-auto gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  {bulkDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCheckedIds(new Set())}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {messagesLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-theme-text-tertiary" />
                </div>
              ) : messagesError ? (
                <div className="px-4 py-8 text-center text-sm text-red-600">
                  Failed to load emails. Please try again.
                </div>
              ) : messages.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-theme-text-tertiary">
                  {activeQuery ? 'No results found.' : 'Your inbox is empty.'}
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <EmailListItem
                      key={msg.id}
                      message={msg}
                      isSelected={selectedMessageId === msg.id}
                      isChecked={checkedIds.has(msg.id)}
                      onClick={() => handleSelectMessage(msg.id)}
                      onCheck={() => handleToggleCheck(msg.id)}
                    />
                  ))}
                  {nextPageToken && (
                    <div className="flex justify-center py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="gap-1.5"
                      >
                        {loadingMore ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Reading pane */}
          <div
            className={`${
              showMobileReading ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col bg-white min-w-0`}
          >
            {selectedMessageId ? (
              <ReadingPane
                messageId={selectedMessageId}
                onBack={handleMobileBack}
                onCompose={handleCompose}
                onActionDone={handleActionDone}
                account={selectedAccount || undefined}
              />
            ) : (
              <EmptyReadingPane />
            )}
          </div>
        </div>
      </div>

      {/* Compose modal */}
      {composeState && (
        <ComposeModal
          initial={composeState}
          onClose={() => setComposeState(null)}
          onSent={handleSent}
        />
      )}

      {/* Inbox Cleaner modal */}
      {showInboxCleaner && (
        <InboxCleanerModal
          onClose={() => setShowInboxCleaner(false)}
          account={selectedAccount || undefined}
        />
      )}
    </>
  )
}
