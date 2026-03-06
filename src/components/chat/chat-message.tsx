import React from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import type { Message } from './chat-types'
import { renderMarkdown, formatMessageTime, formatDayDivider, shouldShowDivider } from './chat-utils'

interface ChatMessageProps {
  message: Message
  index: number
  messages: Message[]
  copiedIndex: number | null
  onCopy: (text: string, index: number) => void
  onRetry: () => void
  onCompleteTask: (messageIndex: number, taskId: string) => void
}

export const ChatMessage = React.memo(function ChatMessage({
  message: m,
  index: i,
  messages,
  copiedIndex,
  onCopy,
  onRetry,
  onCompleteTask,
}: ChatMessageProps) {
  return (
    <div>
      {/* Day divider */}
      {shouldShowDivider(messages, i) && m.timestamp && (
        <div className="flex items-center gap-2 my-2">
          <div className="flex-1 h-px bg-theme-neutral-200" />
          <span className="text-[10px] text-theme-text-tertiary font-medium">{formatDayDivider(m.timestamp)}</span>
          <div className="flex-1 h-px bg-theme-neutral-200" />
        </div>
      )}
      <div className={m.role === "user" ? "text-right" : "text-left group"}>
        <div
          className={`inline-block rounded-lg px-3 py-2 whitespace-pre-wrap max-w-[80%] ${
            m.role === "user"
              ? "bg-theme-secondary text-white"
              : m.isError
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-theme-brand-tint-light text-theme-text-primary"
          }`}
        >
          {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
          {m.audio && m.role === 'user' && (
            <div className="mt-2">
              <audio controls className="w-full max-w-[200px]">
                <source src={m.audio} type="audio/webm" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
          {m.createdTask && m.role === 'assistant' && (
            <div className="mt-2 border border-theme-neutral-300 rounded-md bg-white text-theme-text-primary p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="font-medium">{m.createdTask.content || 'New task'}</div>
                  {m.createdTask.due?.date && (
                    <div className="text-theme-text-tertiary">Due {m.createdTask.due.date}</div>
                  )}
                </div>
                {!m.createdTask.completed ? (
                  <button
                    onClick={() => {
                      const taskId = (m.createdTask as any)?.id
                      if (taskId) onCompleteTask(i, String(taskId))
                    }}
                    className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    Mark done
                  </button>
                ) : (
                  <span className="text-xs text-green-600">Completed</span>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Timestamp + Copy + Retry for assistant messages */}
        {m.role === 'assistant' && (
          <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {m.timestamp && (
              <span className="text-[10px] text-theme-text-tertiary mr-1">{formatMessageTime(m.timestamp)}</span>
            )}
            <button
              onClick={() => onCopy(m.content, i)}
              className="p-0.5 text-[#8e99a8] hover:text-[#4a5568]"
              title="Copy"
              aria-label="Copy message"
            >
              {copiedIndex === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
            {m.isError && (
              <button
                onClick={onRetry}
                className="p-0.5 text-[#8e99a8] hover:text-[#4a5568]"
                title="Retry"
                aria-label="Retry message"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {/* User message timestamp */}
        {m.role === 'user' && m.timestamp && (
          <div className="text-[10px] text-theme-text-tertiary mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatMessageTime(m.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
})
