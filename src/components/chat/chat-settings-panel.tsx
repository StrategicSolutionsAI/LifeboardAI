import React from 'react'
import { X } from 'lucide-react'

interface ChatSettingsPanelProps {
  panelRef: React.Ref<HTMLDivElement>
  onClose: () => void
  useRealtime: boolean
  onRealtimeChange: (v: boolean) => void
  onDetectDevices: () => void
  isEnumerating: boolean
  ttsVoice: string
  onVoiceChange: (v: string) => void
  micDeviceId: string
  onMicChange: (id: string) => void
  devices: MediaDeviceInfo[]
  speakerDeviceId: string
  onSpeakerChange: (id: string) => void
  ttsRate: number
  onRateChange: (r: number) => void
  isRealtimeActive: boolean
  rtConnState: string
  rtIceState: string
  rtGatheringState: string
  rtReconnecting: boolean
  onReconnect: () => void
}

const VOICE_OPTIONS = ['Chloe','Evelyn','Laura','Madison','Anaya','Abigail','Meera','Marisol','Lucy','Aaron','Ethan','Brian','Gordon','Andy','Dylan','Archer','Emmanuel','Gavin','Ivan','Walter']

export const ChatSettingsPanel = React.memo(function ChatSettingsPanel({
  panelRef,
  onClose,
  useRealtime,
  onRealtimeChange,
  onDetectDevices,
  isEnumerating,
  ttsVoice,
  onVoiceChange,
  micDeviceId,
  onMicChange,
  devices,
  speakerDeviceId,
  onSpeakerChange,
  ttsRate,
  onRateChange,
  isRealtimeActive,
  rtConnState,
  rtIceState,
  rtGatheringState,
  rtReconnecting,
  onReconnect,
}: ChatSettingsPanelProps) {
  return (
    <div ref={panelRef} className="absolute bottom-14 right-3 bg-white border shadow-warm-lg rounded-md p-3 w-64 z-50">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-theme-text-body">Voice Settings</div>
        <button
          onClick={onClose}
          className="text-theme-text-tertiary hover:text-theme-text-body p-0.5 rounded transition-colors"
          aria-label="Close settings"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <label className="flex items-center justify-between mb-3 text-xs text-theme-text-body">
        <span>Realtime voice (beta)</span>
        <input
          type="checkbox"
          checked={useRealtime}
          onChange={(e) => onRealtimeChange(e.target.checked)}
        />
      </label>
      <div className="mb-3">
        <button
          onClick={onDetectDevices}
          className="text-[11px] text-theme-text-subtle hover:text-theme-text-primary underline"
        >
          {isEnumerating ? 'Detecting devices\u2026' : 'Detect audio devices'}
        </button>
      </div>
      <label className="block mb-2">
        <span className="text-xs text-theme-text-tertiary">Voice</span>
        <select
          value={ttsVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="mt-1 w-full border rounded px-2 py-1 text-sm"
        >
          {VOICE_OPTIONS.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </label>
      <label className="block mb-2">
        <span className="text-xs text-theme-text-tertiary">Microphone</span>
        <select
          value={micDeviceId}
          onChange={(e) => onMicChange(e.target.value)}
          className="mt-1 w-full border rounded px-2 py-1 text-sm"
        >
          <option value="">System default</option>
          {devices.filter(d => d.kind === 'audioinput').map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
          ))}
        </select>
        {micDeviceId && /iphone|continuity/i.test((devices.find(d=>d.deviceId===micDeviceId)?.label)||'') && (
          <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">Selected mic appears to be an iPhone/Continuity device. If you see macOS &quot;Audio Disconnected&quot; alerts, choose a built-in or USB mic.</div>
        )}
      </label>
      <label className="block mb-3">
        <span className="text-xs text-theme-text-tertiary">Speaker</span>
        <select
          value={speakerDeviceId}
          onChange={(e) => onSpeakerChange(e.target.value)}
          className="mt-1 w-full border rounded px-2 py-1 text-sm"
        >
          <option value="">Browser default</option>
          {devices.filter(d => d.kind === 'audiooutput').map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>
          ))}
        </select>
        <div className="mt-1 flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const a = new Audio('data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQwAAAAA//8AAP//AAD//wAA//8AAP//AAD//wAA')
                if (speakerDeviceId && typeof (a as any).setSinkId === 'function') {
                  await (a as any).setSinkId(speakerDeviceId)
                }
                await a.play()
              } catch (e) { console.warn('Test beep failed', e) }
            }}
            className="text-[11px] px-2 py-1 rounded border hover:bg-theme-surface-alt"
          >
            Test beep
          </button>
        </div>
      </label>
      <label className="block">
        <div className="flex items-center justify-between text-xs text-theme-text-tertiary">
          <span>Speaking rate</span>
          <span>{ttsRate.toFixed(2)}&times;</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.05}
          value={ttsRate}
          onChange={(e) => onRateChange(Number(e.target.value))}
          className="w-full"
        />
      </label>
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-3 border-t pt-2">
          <div className="text-[10px] text-theme-text-tertiary">Debug</div>
          <div className="text-[10px] text-theme-text-tertiary">Realtime: {isRealtimeActive ? 'active' : 'inactive'}</div>
          {isRealtimeActive && (
            <div className="text-[10px] text-theme-text-tertiary">
              conn:{rtConnState || '\u2014'} ice:{rtIceState || '\u2014'} gather:{rtGatheringState || '\u2014'}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={onReconnect}
              className={`text-xs px-2 py-1 rounded border ${rtReconnecting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-theme-surface-alt'}`}
              disabled={rtReconnecting}
            >
              {rtReconnecting ? 'Reconnecting\u2026' : 'Reconnect Realtime'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
