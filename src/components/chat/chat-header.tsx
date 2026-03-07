import React from 'react'
import { MessageSquare, Trash2, X } from 'lucide-react'

interface ChatHeaderProps {
  isVoiceMode: boolean
  isRealtimeActive: boolean
  rtConnState: string
  rtIceState: string
  rtGatheringState: string
  hasMessages: boolean
  onClearChat: () => void
  onClose: () => void
}

export const ChatHeader = React.memo(function ChatHeader({
  isVoiceMode,
  isRealtimeActive,
  rtConnState,
  rtIceState,
  rtGatheringState,
  hasMessages,
  onClearChat,
  onClose,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b">
      <div className="flex items-center gap-2 font-medium text-sm text-theme-text-body">
        <MessageSquare className="w-4 h-4 text-theme-secondary" /> Chat
        {isVoiceMode && (
          <span
            className={`ml-2 text-[11px] leading-5 inline-flex items-center gap-1 rounded-full px-2 border ${
              isRealtimeActive
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={isRealtimeActive ? `conn:${rtConnState || 'active'} ice:${rtIceState || 'n/a'} gather:${rtGatheringState || 'n/a'}` : 'HTTP voice fallback'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeActive ? 'bg-green-500' : 'bg-amber-500'}`}></span>
            {isRealtimeActive ? 'Realtime' : 'Voice (fallback)'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {hasMessages && (
          <button onClick={onClearChat} aria-label="Clear chat" title="Clear chat" className="text-theme-text-tertiary hover:text-theme-text-body">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onClose} aria-label="Close chat">
          <X className="w-4 h-4 text-theme-text-tertiary" />
        </button>
      </div>
    </div>
  )
})
