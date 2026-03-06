import React from 'react'
import { Send, Mic, Volume2, VolumeX, Settings } from 'lucide-react'

interface ChatInputProps {
  isVoiceMode: boolean
  isRecording: boolean
  silenceProgress: number
  recordingDuration: number
  micLevel: number
  input: string
  onInputChange: (value: string) => void
  isProcessing: boolean
  isSpeaking: boolean
  processingStage: 'transcribing' | 'thinking' | 'speaking' | null
  inputRef: React.Ref<HTMLTextAreaElement>
  onToggleSettings: () => void
  speakReplies: boolean
  onToggleSpeakReplies: () => void
  onToggleVoiceMode: () => void
  onSend: () => void
}

export const ChatInput = React.memo(function ChatInput({
  isVoiceMode,
  isRecording,
  silenceProgress,
  recordingDuration,
  micLevel,
  input,
  onInputChange,
  isProcessing,
  isSpeaking,
  processingStage,
  inputRef,
  onToggleSettings,
  speakReplies,
  onToggleSpeakReplies,
  onToggleVoiceMode,
  onSend,
}: ChatInputProps) {
  return (
    <div className="border-t flex items-center gap-2 px-3 py-2 relative">
      {/* Recording indicator replaces input when actively recording */}
      {isVoiceMode && isRecording ? (
        <div className="flex-1 flex items-center gap-2">
          <div className="flex items-center gap-1.5 relative">
            {/* Silence countdown ring */}
            {silenceProgress > 0 && (
              <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)]" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="#fca5a5" strokeWidth="2" strokeDasharray={`${silenceProgress * 62.8} 62.8`} strokeLinecap="round" transform="rotate(-90 12 12)" />
              </svg>
            )}
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-red-600">
              {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-[3px] px-2">
            {/* Reactive audio level bars driven by mic RMS */}
            {[0.6, 1.0, 0.8, 1.0, 0.6].map((scale, i) => (
              <div
                key={i}
                className="w-1 bg-red-400 rounded-full transition-[height] duration-100"
                style={{
                  height: `${4 + micLevel * scale * 16}px`,
                }}
              />
            ))}
          </div>
          <span className="text-[11px] text-theme-text-tertiary">
            {silenceProgress > 0 ? 'Sending soon...' : 'Tap mic to send'}
          </span>
        </div>
      ) : (
        <textarea
          className="flex-1 text-sm outline-none placeholder-theme-text-tertiary resize-none max-h-20 overflow-y-auto bg-theme-surface-alt/50 rounded-lg px-2.5 py-1.5 focus:bg-theme-surface-alt transition-colors"
          rows={1}
          placeholder={
            isVoiceMode
              ? (isSpeaking ? "AI speaking\u2026 tap mic to interrupt" :
                 processingStage === 'transcribing' ? "Transcribing\u2026" :
                 processingStage === 'thinking' ? "Thinking\u2026" :
                 processingStage === 'speaking' ? "Generating audio\u2026" :
                 isProcessing ? "Processing\u2026" :
                 "Tap mic or hold Space to speak")
              : "Type a message\u2026"
          }
          value={input}
          onChange={(e) => {
            onInputChange(e.target.value)
            // Auto-resize: reset to 1 row then expand to content
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          ref={inputRef}
        />
      )}
      {/* Settings Toggle */}
      <button
        onClick={onToggleSettings}
        className="text-theme-text-tertiary/70 hover:text-theme-primary-600"
        aria-label="TTS settings"
        title="Voice settings"
      >
        <Settings className="w-4 h-4" />
      </button>
      {/* Speak Replies Toggle */}
      <button
        onClick={onToggleSpeakReplies}
        className={`transition-colors ${speakReplies ? 'text-theme-primary-600 bg-theme-primary-50 rounded-full p-1' : 'text-theme-text-tertiary/70 hover:text-theme-primary-600'}`}
        aria-label={speakReplies ? 'Mute spoken replies' : 'Enable spoken replies'}
        title={speakReplies ? 'Spoken replies on' : 'Spoken replies off'}
      >
        {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      {/* Voice Mode Toggle / Push-to-talk */}
      <button
        onClick={onToggleVoiceMode}
        className={`transition-all ${
          isRecording
            ? 'text-white bg-red-500 rounded-full p-1.5 shadow-md hover:bg-red-600'
            : isSpeaking
              ? 'text-theme-secondary bg-theme-primary-50 rounded-full p-1 hover:bg-theme-surface-selected ring-2 ring-theme-secondary/30'
              : isVoiceMode
                ? 'text-green-500 bg-green-50 rounded-full p-1 hover:bg-green-100'
                : 'text-theme-text-tertiary/70 hover:text-theme-primary-600'
        }`}
        aria-label={isRecording ? "Stop recording and send" : isSpeaking ? "Tap to interrupt" : isVoiceMode ? "Start recording" : "Start voice conversation"}
        title={isRecording ? "Tap to send" : isSpeaking ? "Tap to interrupt" : isVoiceMode ? "Tap to record" : "Voice mode"}
      >
        {isRecording ? (
          <Send className="w-4 h-4" />
        ) : isVoiceMode ? (
          <div className="flex items-center gap-1">
            {isSpeaking ? (
              <div className="w-2 h-2 bg-theme-secondary rounded-full animate-pulse"></div>
            ) : isProcessing ? (
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            ) : (
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            )}
            <Mic className="w-4 h-4" />
          </div>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
      {!isRecording && (
        <button onClick={onSend} className="text-theme-secondary" aria-label="Send message">
          <Send className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})
