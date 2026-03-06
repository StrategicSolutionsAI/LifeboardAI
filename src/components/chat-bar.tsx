"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, WifiOff } from "lucide-react"
import { invalidateTaskCaches } from "@/hooks/use-data-cache"
import type { Message } from "./chat/chat-types"
import {
  getFollowUpChips,
  loadStoredMessages,
  ensureIds,
  cleanAssistantContent,
  CHAT_STORAGE_KEY,
} from "./chat/chat-utils"
import { ChatHeader } from "./chat/chat-header"
import { ChatMessage } from "./chat/chat-message"
import { ChatInput } from "./chat/chat-input"
import { ChatSettingsPanel } from "./chat/chat-settings-panel"

export function ChatBar() {
  const [messages, _setMessagesRaw] = useState<Message[]>(loadStoredMessages)
  /** Wrapper around setState that auto-assigns missing IDs. */
  const setMessages: typeof _setMessagesRaw = useCallback(
    (action) =>
      _setMessagesRaw((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        return ensureIds(next)
      }),
    []
  )
  const [input, setInput] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState<'transcribing' | 'thinking' | 'speaking' | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const [silenceProgress, setSilenceProgress] = useState(0)
  const silenceStartRef = useRef<number>(0)
  const lastFailedInputRef = useRef<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [ttsVoice, setTtsVoice] = useState<string>('Chloe')
  const [ttsRate, setTtsRate] = useState<number>(1.0)
  const [useRealtime, setUseRealtime] = useState<boolean>(false)
  // Device selection
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [micDeviceId, setMicDeviceId] = useState<string>('')
  const [speakerDeviceId, setSpeakerDeviceId] = useState<string>('')
  const [isEnumerating, setIsEnumerating] = useState<boolean>(false)
  const [hasRequestedDeviceAccess, setHasRequestedDeviceAccess] = useState<boolean>(false)

  const quickPrompts = [
    'What are my top tasks for today?',
    'Add a reminder to call the dentist tomorrow at 9am.',
    'Summarize my progress this week.'
  ]

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const volumeCheckRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const helloTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Track recording state in a ref so silence detection doesn't use stale closure
  const isRecordingRef = useRef<boolean>(false)
  // Track when recording started for minimum duration enforcement
  const recordingStartRef = useRef<number>(0)
  // Track recording duration for display
  const [recordingDuration, setRecordingDuration] = useState<number>(0)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Live mic level (0-1) for reactive audio bars
  const [micLevel, setMicLevel] = useState<number>(0)
  const micLevelFrameRef = useRef<number>(0)
  // Barge-in monitoring refs (listen while speaking)
  const bargeStreamRef = useRef<MediaStream | null>(null)
  const bargeCtxRef = useRef<AudioContext | null>(null)
  const bargeAnalyserRef = useRef<AnalyserNode | null>(null)
  const bargeRAFRef = useRef<number | null>(null)
  const bargeHotRef = useRef<boolean>(false)
  // Realtime voice agent refs
  const rtPCRef = useRef<RTCPeerConnection | null>(null)
  const rtLocalStreamRef = useRef<MediaStream | null>(null)
  const rtRemoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)
  const [rtConnState, setRtConnState] = useState<string>('')
  const [rtIceState, setRtIceState] = useState<string>('')
  const [rtGatheringState, setRtGatheringState] = useState<string>('')
  const [rtReconnecting, setRtReconnecting] = useState(false)
  const rtDCRef = useRef<RTCDataChannel | null>(null)
  const rtTextBufferRef = useRef<string>('')
  const rtLastTranscriptRef = useRef<string>('')
  const rtCreateLockRef = useRef<boolean>(false)
  const rtAudioTranscriptRef = useRef<string>('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)

  const notifyTasksUpdated = useCallback((retryDelays?: number[]) => {
    if (typeof window === 'undefined') return
    // Aggressively clear all client-side task caches first
    invalidateTaskCaches()
    const timestamp = Date.now()
    try {
      window.localStorage.setItem('lifeboard:last-tasks-update', String(timestamp))
    } catch {}
    // nocache: true tells use-tasks to bypass server-side cache (handles serverless process isolation)
    window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp, nocache: true } }))
    // Schedule delayed retries to handle eventual consistency (e.g. Todoist API propagation,
    // server-side cache in a different serverless process)
    if (retryDelays) {
      for (const delay of retryDelays) {
        setTimeout(() => {
          invalidateTaskCaches()
          const ts = Date.now()
          try {
            window.localStorage.setItem('lifeboard:last-tasks-update', String(ts))
          } catch {}
          window.dispatchEvent(new CustomEvent('lifeboard:tasks-updated', { detail: { timestamp: ts, nocache: true } }))
        }, delay)
      }
    }
  }, [])

  // Load persisted TTS settings
  useEffect(() => {
    try {
      const v = localStorage.getItem('chat_tts_voice')
      const r = localStorage.getItem('chat_tts_rate')
      if (v) setTtsVoice(v)
      if (r && !Number.isNaN(Number(r))) setTtsRate(Number(r))
      const ur = localStorage.getItem('chat_use_realtime')
      if (ur != null) setUseRealtime(ur === '1')
      const mid = localStorage.getItem('chat_mic_device_id')
      const sid = localStorage.getItem('chat_speaker_device_id')
      if (mid) setMicDeviceId(mid)
      if (sid) setSpeakerDeviceId(sid)
    } catch {}
  }, [])

  // Persist TTS settings
  useEffect(() => {
    try {
      localStorage.setItem('chat_tts_voice', ttsVoice)
      localStorage.setItem('chat_tts_rate', String(ttsRate))
      localStorage.setItem('chat_use_realtime', useRealtime ? '1' : '0')
      localStorage.setItem('chat_mic_device_id', micDeviceId || '')
      localStorage.setItem('chat_speaker_device_id', speakerDeviceId || '')
    } catch {}
  }, [ttsVoice, ttsRate, micDeviceId, speakerDeviceId, useRealtime])

  // Enumerate audio devices and optionally ask for permission to reveal labels
  const enumerateAudioDevices = useCallback(async (requestPermission: boolean = false) => {
    if (isEnumerating) return
    setIsEnumerating(true)
    let permissionStream: MediaStream | null = null
    try {
      if (requestPermission && !hasRequestedDeviceAccess) {
        permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setHasRequestedDeviceAccess(true)
      }
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list)
      if (!micDeviceId) {
        const inputs = list.filter(d => d.kind === 'audioinput')
        const preferred = inputs.find(d => !/iphone|continuity/i.test(d.label)) || inputs[0]
        if (preferred?.deviceId) setMicDeviceId(preferred.deviceId)
      }
    } catch (e) {
      console.warn('Failed to enumerate devices', e)
      try {
        const list = await navigator.mediaDevices.enumerateDevices()
        setDevices(list)
      } catch {}
    } finally {
      if (permissionStream) {
        permissionStream.getTracks().forEach(t => t.stop())
        permissionStream = null
      }
      setIsEnumerating(false)
    }
  }, [hasRequestedDeviceAccess, isEnumerating, micDeviceId])

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      enumerateAudioDevices(false)
      const onChange = () => enumerateAudioDevices(false)
      navigator.mediaDevices.addEventListener?.('devicechange', onChange)
      return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange)
    }
  }, [enumerateAudioDevices])

  useEffect(() => {
    if (showSettings && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      enumerateAudioDevices(!hasRequestedDeviceAccess)
    }
  }, [showSettings, hasRequestedDeviceAccess, enumerateAudioDevices])

  // Close settings panel on click-outside or Escape key
  useEffect(() => {
    if (!showSettings) return
    const handleClick = (e: MouseEvent) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showSettings])

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [isOpen])

  // Space key push-to-talk: hold Space to record, release to send (only when voice mode + chat open)
  useEffect(() => {
    if (!isOpen || !isVoiceMode || isRealtimeActive) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      // Don't hijack Space when typing in the input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      if (!isRecording && !isProcessing && !isSpeaking) {
        startRecording()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      if (isRecording) {
        stopRecording()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isOpen, isVoiceMode, isRealtimeActive, isRecording, isProcessing, isSpeaking])

  // Scroll to bottom whenever messages update, processing state changes, or chat opens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isProcessing, isSpeaking, isOpen])

  // Persist messages to localStorage (strip audio blob URLs)
  useEffect(() => {
    try {
      const toStore = messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || undefined,
        createdTask: m.createdTask || undefined,
      }))
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore.slice(-50)))
    } catch {}
  }, [messages])

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Focus trap: keep Tab focus within the chat dialog when open
  const chatPanelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!isOpen) return
    const panel = chatPanelRef.current
    if (!panel) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  // Schedule a "hello" assistant message every day at 11:55 AM CT (browser local time)
  useEffect(() => {
    function scheduleHello() {
      // Clear any existing timeout
      if (helloTimeoutRef.current) clearTimeout(helloTimeoutRef.current)

      const now = new Date()
      const target = new Date(now)
      target.setHours(10, 0, 0, 0) // 10:00:00 local time
      if (target.getTime() <= now.getTime()) {
        // If already past today 11:55, schedule for tomorrow
        target.setDate(target.getDate() + 1)
      }
      const msUntil = target.getTime() - now.getTime()
      helloTimeoutRef.current = setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: "Hi Dalit, let me know if I can help you with anything", timestamp: Date.now() }])
        // Reschedule for next day
        scheduleHello()
      }, msUntil)
    }

    scheduleHello()
    return () => {
      if (helloTimeoutRef.current) clearTimeout(helloTimeoutRef.current)
    }
  }, [])

  // Silence detection function — uses refs (not state) to avoid stale closures
  function detectSilence() {
    if (!analyserRef.current || !isRecordingRef.current) {
      return
    }

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate RMS (Root Mean Square) for better volume detection
    const rms = Math.sqrt(dataArray.reduce((sum, value) => sum + value * value, 0) / bufferLength)
    const threshold = 10 // Lowered threshold — less sensitive to background noise

    // Update mic level for reactive UI bars (throttled to every 3rd frame)
    micLevelFrameRef.current++
    if (micLevelFrameRef.current % 3 === 0) {
      setMicLevel(Math.min(1, rms / 60))
    }

    // Enforce minimum recording duration of 2 seconds before silence detection
    const elapsed = Date.now() - recordingStartRef.current
    const MIN_RECORDING_MS = 2000

    if (elapsed > MIN_RECORDING_MS && rms < threshold) {
      // Start silence timer if not already started — 2.5s of silence before auto-send
      if (!silenceTimeoutRef.current) {
        silenceStartRef.current = Date.now()
        silenceTimeoutRef.current = setTimeout(() => {
          setSilenceProgress(0)
          if (isRecordingRef.current) {
            stopRecording()
          }
        }, 2500)
      }
      // Update visual countdown progress (0→1 over 2.5s)
      const silenceElapsed = Date.now() - silenceStartRef.current
      setSilenceProgress(Math.min(1, silenceElapsed / 2500))
    } else {
      // Clear silence timer if sound detected (or still within minimum duration)
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
        silenceStartRef.current = 0
        setSilenceProgress(0)
      }
    }

    // Continue monitoring if still recording (use ref, not state)
    if (isRecordingRef.current) {
      volumeCheckRef.current = requestAnimationFrame(detectSilence)
    }
  }

  // Barge-in monitor: listen to mic while AI is speaking
  async function startBargeMonitor() {
    try {
      if (bargeStreamRef.current) return
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      bargeStreamRef.current = stream
      bargeCtxRef.current = ctx
      bargeAnalyserRef.current = analyser

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      let aboveCount = 0
      const framesNeeded = 6 // ~100ms (assuming ~60fps)
      const threshold = 22 // slightly higher than silence detector to avoid false positives

      const tick = () => {
        if (!bargeAnalyserRef.current) return
        bargeAnalyserRef.current.getByteFrequencyData(dataArray)
        const rms = Math.sqrt(dataArray.reduce((s, v) => s + v * v, 0) / bufferLength)
        if (rms > threshold) {
          aboveCount++
          if (!bargeHotRef.current && aboveCount >= framesNeeded) {
            bargeHotRef.current = true
            cancelTTS()
            stopBargeMonitor()
            if (!isRecording) startRecording()
            return
          }
        } else {
          aboveCount = Math.max(0, aboveCount - 1)
        }
        bargeRAFRef.current = requestAnimationFrame(tick)
      }
      bargeRAFRef.current = requestAnimationFrame(tick)
    } catch (e) {
      console.warn('Barge-in monitor failed to start', e)
    }
  }

  function stopBargeMonitor() {
    if (bargeRAFRef.current) cancelAnimationFrame(bargeRAFRef.current)
    bargeRAFRef.current = null
    if (bargeCtxRef.current) {
      try { bargeCtxRef.current.close() } catch {}
      bargeCtxRef.current = null
    }
    if (bargeStreamRef.current) {
      bargeStreamRef.current.getTracks().forEach(t => t.stop())
      bargeStreamRef.current = null
    }
    bargeAnalyserRef.current = null
    bargeHotRef.current = false
  }

  // Barge-in monitor disabled — browser echo cancellation is unreliable, so the
  // AI's own audio leaks into the mic and triggers a false barge-in that cuts off
  // the response mid-playback. Users can manually tap the mic to interrupt instead.
  useEffect(() => {
    stopBargeMonitor()
  }, [isVoiceMode, isSpeaking, isRealtimeActive])

  // Voice recording functions
  async function startRecording() {
    try {
      // If we're speaking, stop so you can barge in
      cancelTTS()
      
      // Try with specific device first, fallback to default if it fails
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          } 
        })
      } catch (deviceError: any) {
        console.warn('⚠️ Failed with specific device, trying default microphone:', deviceError)
        // If specific device fails, try without device constraint
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          } 
        })
        // Clear the saved device ID since it's not working
        setMicDeviceId('')
      }
      
      if (!stream) throw new Error('Failed to get microphone stream')

      setHasRequestedDeviceAccess(true)
      enumerateAudioDevices(false)

      // Set up audio analysis for silence detection
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyserNode = context.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.8
      source.connect(analyserNode)
      
      audioContextRef.current = context
      analyserRef.current = analyserNode
      
      // Pick a supported audio mime type for cross-browser compatibility
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ]
      const chosenType = preferredTypes.find(t => (window as any).MediaRecorder?.isTypeSupported?.(t)) || ''
      const recorder = chosenType
        ? new MediaRecorder(stream, { mimeType: chosenType })
        : new MediaRecorder(stream)
      
      audioChunksRef.current = []
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: (recorder as any).mimeType || chosenType || 'audio/webm' })

        // Clean up audio analysis
        if (volumeCheckRef.current) {
          cancelAnimationFrame(volumeCheckRef.current)
          volumeCheckRef.current = null
        }
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
          silenceTimeoutRef.current = null
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        setRecordingDuration(0)

        if (audioBlob.size > 0) {
          setIsProcessing(true)
          await handleVoiceMessage(audioBlob)
          setIsProcessing(false)
        } else {
          console.warn('⚠️ No audio data recorded')
        }

        stream.getTracks().forEach(track => track.stop())
      }
      
      // Record in chunks to get better data
      recorder.start(100) // Record data every 100ms
      mediaRecorderRef.current = recorder
      isRecordingRef.current = true
      recordingStartRef.current = Date.now()
      setIsRecording(true)
      setRecordingDuration(0)

      // Start a timer to display recording duration
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartRef.current) / 1000))
      }, 1000)

      // Start silence detection
      detectSilence()
      
    } catch (error: any) {
      console.error('❌ Error accessing microphone:', error)

      // Provide more helpful error messages based on the error type
      let errorMessage = 'Microphone access error. '

      if (error?.name === 'NotAllowedError' || error?.message?.includes('Permission denied')) {
        errorMessage += 'Permission denied. To use voice mode:\n\n' +
          '1. Click the lock or info icon in your browser\'s address bar\n' +
          '2. Find "Microphone" permissions\n' +
          '3. Change it to "Allow"\n' +
          '4. Refresh the page and try again'
      } else if (error?.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.'
      } else if (error?.name === 'NotReadableError') {
        errorMessage += 'Microphone is already in use by another application. Please close other apps using your microphone and try again.'
      } else {
        errorMessage += `${error?.message || 'Unknown error'}. Please check your browser permissions and try again.`
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: errorMessage
      }])

      // Reset voice mode state on error
      isRecordingRef.current = false
      setIsVoiceMode(false)
      setIsRecording(false)
      setRecordingDuration(0)
    }
  }

  function stopRecording() {
    isRecordingRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    setRecordingDuration(0)
    setMicLevel(0)

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    if (volumeCheckRef.current) {
      cancelAnimationFrame(volumeCheckRef.current)
      volumeCheckRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  function toggleVoiceMode() {
    if (isVoiceMode && isRecording) {
      // Already recording — tap again to stop and send (push-to-talk UX)
      stopRecording()
      return
    }

    if (isVoiceMode && isSpeaking) {
      // AI is speaking — interrupt playback and start recording (manual barge-in)
      cancelTTS()
      startRecording()
      return
    }

    if (isVoiceMode) {
      // Exit voice mode
      // Reset Realtime state guards
      rtTextBufferRef.current = ''
      rtLastTranscriptRef.current = ''
      rtCreateLockRef.current = false
      setIsVoiceMode(false)
      setIsSpeaking(false)
      setIsProcessing(false)
      cancelTTS()
      if (isRecording) {
        stopRecording()
      }
      stopBargeMonitor()
      stopRealtime()
      // Stop any playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    } else {
      // Enter voice mode
      // Reset guards for a clean session
      rtTextBufferRef.current = ''
      rtLastTranscriptRef.current = ''
      rtCreateLockRef.current = false
      setIsVoiceMode(true)
      if (useRealtime) {
        // Prefer Realtime agent; fallback to classic STT if it fails
        startRealtime().catch((err) => {
          console.warn('Realtime failed; falling back to HTTP STT', err)
          startRecording()
        })
      } else {
        startRecording()
      }
    }
  }

  async function startRealtime() {
    if (isRealtimeActive) return
    try {
      // 1) Create ephemeral session on the server
      const sessRes = await fetch('/api/openai/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: ttsVoice })
      })
      if (!sessRes.ok) throw new Error('Failed to create realtime session')
      const { client_secret, model } = await sessRes.json()
      if (!client_secret) throw new Error('Missing client_secret')

      // 2) Capture mic - try specific device first, fallback to default
      let local: MediaStream | null = null
      try {
        local = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: micDeviceId ? { exact: micDeviceId } : undefined, echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
        })
      } catch (deviceError: any) {
        console.warn('⚠️ Realtime: Failed with specific device, trying default microphone:', deviceError)
        // If specific device fails, try without device constraint
        local = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
        })
        // Clear the saved device ID since it's not working
        setMicDeviceId('')
      }
      
      if (!local) throw new Error('Failed to get microphone stream')
      
      setHasRequestedDeviceAccess(true)
      enumerateAudioDevices(false)
      rtLocalStreamRef.current = local

      // 3) Create PeerConnection
      const pc = new RTCPeerConnection()
      rtPCRef.current = pc
      setIsRealtimeActive(true)

      // Basic realtime connection state logging
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState
        setRtConnState(s)
      }
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState
        setRtIceState(s)
      }
      pc.onicegatheringstatechange = () => {
        const s = pc.iceGatheringState
        setRtGatheringState(s)
      }
      pc.onicecandidate = (e) => {
      }

      // 4) Attach local mic track
      local.getAudioTracks().forEach((t) => pc.addTrack(t, local))
      // Request to receive an audio track from the model (avoid duplicate m-lines)
      const hasAudioRecv = pc.getTransceivers().some(tr => tr.receiver && tr.receiver.track && tr.receiver.track.kind === 'audio')
      if (!hasAudioRecv) {
        pc.addTransceiver('audio', { direction: 'recvonly' })
      }

      // 5) Prepare element for remote audio (mounted in JSX)
      const remoteAudio = rtRemoteAudioRef.current
      if (!remoteAudio) {
        console.warn('Realtime: remote audio element not available')
      } else {
        remoteAudio.autoplay = true
        remoteAudio.muted = !speakReplies
        remoteAudio.volume = speakReplies ? 1 : 0
        try {
          if (speakerDeviceId && typeof (remoteAudio as any).setSinkId === 'function') {
            await (remoteAudio as any).setSinkId(speakerDeviceId)
          }
        } catch (e) {
          console.warn('Failed to set output device (setSinkId)', e)
        }
      }

      let gotTrack = false
      const trackTimeout = setTimeout(() => {
        if (!gotTrack) {
          console.warn('Realtime: no remote audio track received, falling back to HTTP voice')
          stopRealtime()
          startRecording()
        }
      }, 4000)

      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (stream && rtRemoteAudioRef.current) {
          gotTrack = true
          clearTimeout(trackTimeout)
          rtRemoteAudioRef.current.srcObject = stream
          rtRemoteAudioRef.current
            .play()
            .then(() => {
              setIsSpeaking(true)
            })
            .catch((err) => {
              console.error('Realtime: Audio playback failed:', err)
            })
          rtRemoteAudioRef.current.onplay = () => {
            setIsSpeaking(true)
          }
          rtRemoteAudioRef.current.onpause = rtRemoteAudioRef.current.onended = () => {
            setIsSpeaking(false)
          }
        }
      }

      // 6) Data channel for Realtime events (text transcripts, etc.)
      const dc = pc.createDataChannel('oai-events')
      rtDCRef.current = dc
      dc.onmessage = async (evt) => {
        const data = evt.data
        const lines = typeof data === 'string' ? data.split('\n') : []
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const frame = JSON.parse(line)
            const t = frame?.type
            try {
              if (typeof t === 'string' && (/^response\./.test(t) || /^input_/.test(t))) {
              }
            } catch {}
            // Capture user speech transcript if available and try immediate parse
            if (t === 'input_audio_transcription.completed' && typeof frame.transcript === 'string') {
              const transcript: string = String(frame.transcript || '')
              rtLastTranscriptRef.current = transcript
              // Opportunistic immediate creation from transcript (so we aren't dependent on model text frames)
              try {
                if (!rtCreateLockRef.current) {
                  const triggers = /(add\s+(a\s+)?task|add\s+to\s+tasks|create\s+task)/i
                    if (triggers.test(transcript)) {
                      const now = new Date()
                      let due_date: string | null = null
                      let hour_slot: number | undefined
                    if (/\b(today|tonight)\b/i.test(transcript)) {
                      due_date = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10)
                      // Heuristic: tonight ≈ 8pm local time
                      if (/\btonight\b/i.test(transcript)) {
                        hour_slot = 20
                      }
                    } else if (/\b(tomorrow)\b/i.test(transcript)) {
                      const t2 = new Date(now); t2.setDate(t2.getDate()+1)
                      due_date = new Date(t2.getTime() - t2.getTimezoneOffset()*60000).toISOString().slice(0,10)
                    }
                    const timeMatch = transcript.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
                    if (timeMatch) {
                      let h = parseInt(timeMatch[1], 10)
                      const mer = (timeMatch[3] || '').toLowerCase()
                      if (mer === 'pm' && h < 12) h += 12
                      if (mer === 'am' && h === 12) h = 0
                      if (h >= 0 && h <= 23) hour_slot = h
                    }
                    let bucket: string | undefined
                    const bucketMatch = transcript.match(/\bin\s+(work|personal|health|home|family|household)\b/i)
                    if (bucketMatch) bucket = bucketMatch[1]
                    let content = transcript
                      .replace(/\b(add\s+(a\s+)?task(\s+to)?|create\s+task)\b/i, '')
                      .replace(/\bfor\s+(today|tomorrow|tonight)\b/ig, '')
                      .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/ig, '')
                      .replace(/\bin\s+(work|personal|health|home|family|household)\b/ig, '')
                      .replace(/\s+/g, ' ')
                      .trim()
                    content = cleanAssistantContent(content)
                    if (content) {
                      rtCreateLockRef.current = true
                      const res = await fetch('/api/integrations/todoist/tasks', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content, due_date, hour_slot, bucket })
                      })
                      if (res.ok) {
                        const json = await res.json().catch(() => ({}))
                        // Add a minimal assistant message immediately for feedback
                        const confirmText = `✅ I added “${content}”${due_date ? ` for ${due_date}` : ''}.`
                        setMessages(prev => [...prev, { role: 'assistant', content: confirmText, createdTask: json.task || null }])
                        notifyTasksUpdated()
                      } else {
                        console.warn('⚠️ Realtime transcript task create failed', res.status)
                        rtCreateLockRef.current = false
                      }
                    }
                  }
                }
              } catch {}
            }

            // Accumulate assistant audio transcript as a fallback source of text
            if (t === 'response.audio_transcript.delta' && typeof frame.delta === 'string') {
              rtAudioTranscriptRef.current += frame.delta
            }
            if (t === 'response.audio_transcript.done') {
              const aText = (rtAudioTranscriptRef.current || '').trim()
              rtAudioTranscriptRef.current = ''
              if (aText && !rtCreateLockRef.current) {
                try {
                  // 0) Try to salvage a JSON command printed in speech text
                  const jsonCmdMatch = aText.match(/\{\s*"action"\s*:\s*"create_task"[\s\S]*?\}/)
                  if (jsonCmdMatch) {
                    try {
                      const cmd = JSON.parse(jsonCmdMatch[0]) as { action?: string; content?: string; due_date?: string; hour_slot?: number; bucket?: string }
                      if (cmd && cmd.action === 'create_task' && cmd.content) {
                        const res = await fetch('/api/integrations/todoist/tasks', {
                          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ content: cmd.content, due_date: cmd.due_date || null, hour_slot: typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined, bucket: cmd.bucket || undefined })
                        })
                        if (res.ok) {
                          const json = await res.json().catch(() => ({}))
                          rtCreateLockRef.current = true
                          setMessages(prev => [...prev, { role: 'assistant', content: `✅ I added “${cmd.content}”${cmd.due_date ? ` for ${cmd.due_date}` : ''}.`, createdTask: json.task || null }])
                          notifyTasksUpdated()
                          return
                        }
                      }
                    } catch {}
                  }

                  // 1) Natural language fallback on assistant transcript
                  const candidate = aText
                  const triggers = /(\badd\b|\bschedule\b|\bcreate\b|\bmake\b|\bset\b|\bput\b|\bremind\b|\bi\s*(?:just\s*)?added\b|\bi(?:'|’)ve\s+added\b|\bit(?:'|’)s\s+added\b|\badded\s+it\b|\bi(?:'|’)ll\s*add\b)/i
                  const quotedAny = (candidate.match(/[“\"']([^”\"']+)[”\"']/) || [])[1]
                  const userTextNL = (rtLastTranscriptRef.current || '').trim()
                  // Require either quoted content or a user transcript; don't create from assistant filler alone
                  if (!(quotedAny || userTextNL)) {
                    return
                  }
                  if (triggers.test(candidate) || quotedAny) {
                    const now = new Date()
                    let due_date: string | null = null
                    let hour_slot: number | undefined
                    if (/\b(today|tonight)\b/i.test(candidate)) {
                      due_date = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10)
                      if (/\btonight\b/i.test(candidate)) {
                        hour_slot = 20
                      }
                    } else if (/\b(tomorrow)\b/i.test(candidate)) {
                      const t2 = new Date(now); t2.setDate(t2.getDate()+1)
                      due_date = new Date(t2.getTime() - t2.getTimezoneOffset()*60000).toISOString().slice(0,10)
                    }
                    const timeMatch = candidate.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
                    if (timeMatch) {
                      let h = parseInt(timeMatch[1], 10)
                      const mer = (timeMatch[3] || '').toLowerCase()
                      if (mer === 'pm' && h < 12) h += 12
                      if (mer === 'am' && h === 12) h = 0
                      if (h >= 0 && h <= 23) hour_slot = h
                    }
                    let bucket: string | undefined
                    const bucketMatch = candidate.match(/\bin\s+(work|personal|health|home|family|household)\b/i)
                    if (bucketMatch) bucket = bucketMatch[1]
                    let content = ''
                    const quoted = candidate.match(/[“\"']([^”\"']+)[”\"']/)
                    if (quoted && quoted[1]) content = quoted[1].trim()
                    if (!content && userTextNL) {
                      // Prefer user transcript text when available
                      content = userTextNL
                    }
                    if (!content) content = candidate
                      .replace(/\b(add\s+(a\s+)?task(\s+to)?|create\s+task)\b/i, '')
                      .replace(/\b(add|schedule|create|make|set|put|remind)\b/ig, '')
                      .replace(/\b(i\s*(?:just\s*)?added\b|i(?:'|’)ve\s+added\b|it(?:'|’)s\s+added\b|added\s+it\b|i(?:'|’)ll\s*add\b)/ig, '')
                      .replace(/\bfor\s+(today|tomorrow|tonight)\b/ig, '')
                      .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/ig, '')
                      .replace(/\bin\s+(work|personal|health|home|family|household)\b/ig, '')
                      .replace(/\s+/g, ' ')
                      .trim()
                    content = cleanAssistantContent(content)
                    if (content && content.length > 2) {
                      const res = await fetch('/api/integrations/todoist/tasks', {
                        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content, due_date, hour_slot, bucket })
                      })
                      if (res.ok) {
                        const json = await res.json().catch(() => ({}))
                        rtCreateLockRef.current = true
                        setMessages(prev => [...prev, { role: 'assistant', content: `✅ I added “${content}”${due_date ? ` for ${due_date}` : ''}.`, createdTask: json.task || null }])
                        notifyTasksUpdated()
                      } else {
                        console.warn('⚠️ Realtime assistant transcript task create failed', res.status)
                      }
                    }
                  }
                } catch {}
              }
            }
            if (t === 'response.output_text.delta' && typeof frame.delta === 'string') {
              rtTextBufferRef.current += frame.delta
            }
            if (t === 'response.output_text.done' || t === 'response.completed') {
              const text = rtTextBufferRef.current.trim()
              rtTextBufferRef.current = ''
              if (text) {
                // Add assistant message to UI and try to execute any task command
                let createdTask: any = null
                // Detect LIFEBOARD_CMD
                const cmdMatch = text.match(/\[LIFEBOARD_CMD\]([\s\S]*?)\[\/LIFEBOARD_CMD\]/)
                let finalText = text
                if (cmdMatch) {
                  try {
                    const cmd = JSON.parse(cmdMatch[1]) as { action?: string; content?: string; due_date?: string; hour_slot?: number; bucket?: string }
                    if (cmd.action === 'create_task' && cmd.content) {
                      const res = await fetch('/api/integrations/todoist/tasks', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          content: cmd.content,
                          due_date: cmd.due_date || null,
                          hour_slot: typeof cmd.hour_slot === 'number' ? cmd.hour_slot : undefined,
                          bucket: cmd.bucket || undefined,
                        })
                      })
                      if (res.ok) {
                        const json = await res.json()
                        createdTask = json.task || null
                        finalText = text.replace(cmdMatch[0], `\n\n✅ I added “${cmd.content}”${cmd.due_date ? ` for ${cmd.due_date}` : ''}.`)
                        // Broadcast update
                        notifyTasksUpdated()
                      } else {
                        finalText = text.replace(cmdMatch[0], `\n\n⚠️ I couldn’t create the task (auth or server error).`)
                      }
                    }
                  } catch {
                    finalText = text.replace(cmdMatch[0], '')
                  }
                }

                // Fallback when no LIFEBOARD_CMD is present: parse natural language or quoted text
                if (!cmdMatch && !rtCreateLockRef.current) {
                  try {
                    // 0) Try to extract a JSON command object printed without tags
                    const jsonCmdMatch = text.match(/\{\s*"action"\s*:\s*"create_task"[\s\S]*?\}/)
                    if (jsonCmdMatch) {
                      try {
                        const cmd2 = JSON.parse(jsonCmdMatch[0]) as { action?: string; content?: string; due_date?: string; hour_slot?: number; bucket?: string }
                        if (cmd2 && cmd2.action === 'create_task' && cmd2.content) {
                          const res = await fetch('/api/integrations/todoist/tasks', {
                            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: cmd2.content, due_date: cmd2.due_date || null, hour_slot: typeof cmd2.hour_slot === 'number' ? cmd2.hour_slot : undefined, bucket: cmd2.bucket || undefined })
                          })
                          if (res.ok) {
                            const json = await res.json().catch(() => ({}))
                            createdTask = json.task || null
                            finalText = `${text}\n\n✅ I added “${cmd2.content}”${cmd2.due_date ? ` for ${cmd2.due_date}` : ''}.`
                            notifyTasksUpdated()
                            rtCreateLockRef.current = true
                          }
                        }
                      } catch {}
                    }

                    // 1) Liberal triggers: allow "add", "schedule", "remind", etc., not only "task"
                    const triggers = /(\badd\b|\bschedule\b|\bcreate\b|\bmake\b|\bset\b|\bput\b|\bremind\b|\bi\s*(?:just\s*)?added\b|\bi(?:'|’)ve\s+added\b|\bit(?:'|’)s\s+added\b|\badded\s+it\b|\bi(?:'|’)ll\s*add\b)/i
                    const sourceAssistant = text
                    const sourceUser = rtLastTranscriptRef.current || ''
                    const candidate = triggers.test(sourceUser) ? sourceUser : (triggers.test(sourceAssistant) ? sourceAssistant : '')
                    // Also accept if there is a quoted content even without triggers
                    const quotedAny = (candidate.match(/[“\"']([^”\"']+)[”\"']/) || [])[1]
                    if (triggers.test(candidate) || quotedAny) {
                      const now = new Date()
                      let due_date: string | null = null
                      if (/\b(today|tonight)\b/i.test(candidate)) {
                        due_date = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10)
                      } else if (/\b(tomorrow)\b/i.test(candidate)) {
                        const t2 = new Date(now); t2.setDate(t2.getDate()+1)
                        due_date = new Date(t2.getTime() - t2.getTimezoneOffset()*60000).toISOString().slice(0,10)
                      }
                      let hour_slot: number | undefined
                      const timeMatch = candidate.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
                      if (timeMatch) {
                        let h = parseInt(timeMatch[1], 10)
                        const mer = (timeMatch[3] || '').toLowerCase()
                        if (mer === 'pm' && h < 12) h += 12
                        if (mer === 'am' && h === 12) h = 0
                        if (h >= 0 && h <= 23) hour_slot = h
                      }
                      let bucket: string | undefined
                      const bucketMatch = candidate.match(/\bin\s+(work|personal|health|home|family|household)\b/i)
                      if (bucketMatch) bucket = bucketMatch[1]
                      // Try quoted content first (e.g., I added "call Alex")
                      let content = ''
                      const quoted = candidate.match(/[“\"']([^”\"']+)[”\"']/)
                      if (quoted && quoted[1]) {
                        content = quoted[1].trim()
                      }
                      if (!content) content = candidate
                        .replace(/\b(add\s+(a\s+)?task(\s+to)?|create\s+task)\b/i, '')
                        .replace(/\b(i\s*(?:just\s*)?added\b|i(?:'|’)ve\s+added\b|it(?:'|’)s\s+added\b|added\s+it\b|i(?:'|’)ll\s*add\b)/ig, '')
                        .replace(/\b(add|schedule|create|make|set|put|remind)\b/ig, '')
                        .replace(/\bfor\s+(today|tomorrow|tonight)\b/ig, '')
                        .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/ig, '')
                        .replace(/\bin\s+(work|personal|health|home|family|household)\b/ig, '')
                        .replace(/\s+/g, ' ')
                        .trim()
                      if (content) {
                        const res = await fetch('/api/integrations/todoist/tasks', {
                          method: 'POST',
                          credentials: 'same-origin',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ content, due_date, hour_slot, bucket })
                        })
                        if (res.ok) {
                          const json = await res.json()
                          createdTask = json.task || null
                          finalText = `${text}\n\n✅ I added “${content}”${due_date ? ` for ${due_date}` : ''}.`
                          notifyTasksUpdated()
                          rtCreateLockRef.current = true
                        } else {
                          console.warn('⚠️ Realtime fallback task create failed', res.status)
                        }
                      }
                    }
                  } catch {}
                }

                setMessages(prev => [...prev, { role: 'assistant', content: finalText, createdTask }])
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // 7) Create offer SDP
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 8) Send to OpenAI Realtime with ephemeral secret
      const resp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client_secret}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: offer.sdp || ''
      })
      if (!resp.ok) throw new Error(`Realtime SDP exchange failed: ${resp.status}`)
      const answerSDP = await resp.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSDP })

    } catch (e: any) {
      console.error('❌ Realtime voice error:', e)
      setIsRealtimeActive(false)
      stopRealtime()
      
      // Provide helpful error message for microphone permission issues
      if (e?.name === 'NotAllowedError' || e?.message?.includes('Permission denied')) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: 'Microphone access error. Permission denied. To use voice mode:\n\n' +
            '1. Click the 🔒 or ⓘ icon in your browser\'s address bar\n' +
            '2. Find "Microphone" permissions\n' +
            '3. Change it to "Allow"\n' +
            '4. Refresh the page and try again'
        }])
        setIsVoiceMode(false)
        return // Don't throw, just exit gracefully
      }
      
      throw e
    }
  }

  function stopRealtime() {
    try {
      if (rtPCRef.current) {
        try { rtPCRef.current.close() } catch {}
        rtPCRef.current = null
      }
      if (rtLocalStreamRef.current) {
        rtLocalStreamRef.current.getTracks().forEach(t => t.stop())
        rtLocalStreamRef.current = null
      }
      if (rtRemoteAudioRef.current) {
        try { rtRemoteAudioRef.current.pause() } catch {}
        rtRemoteAudioRef.current.srcObject = null
      }
    } finally {
      setIsRealtimeActive(false)
      setRtConnState('')
      setRtIceState('')
      setRtGatheringState('')
    }
  }

  async function reconnectRealtime() {
    if (rtReconnecting) return
    setRtReconnecting(true)
    try {
      stopRealtime()
      await startRealtime()
    } catch (e) {
      console.warn('Realtime reconnect failed, trying HTTP fallback', e)
      // Fallback to classic HTTP voice recording if user stays in voice mode
      if (!isRecording && isVoiceMode) startRecording()
    } finally {
      setRtReconnecting(false)
    }
  }

  async function handleVoiceMessage(audioBlob: Blob) {
    if (isOffline) {
      setMessages(prev => [...prev, { role: "assistant", content: "You appear to be offline. Please check your connection and try again.", isError: true, timestamp: Date.now() }])
      return
    }

    try {

      // Always send to server for transcription (works across browsers)
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice-message.webm')

      // Add voice message to chat (will be updated with transcription when it arrives)
      const newMessages: Message[] = [...messages, {
        role: "user",
        content: "🎤 Voice message",
        audio: URL.createObjectURL(audioBlob),
        timestamp: Date.now()
      }]
      setMessages(newMessages)

      // Include TTS preferences for server TTS
      formData.append('voice', ttsVoice)
      formData.append('speed', String(ttsRate))

      // Send conversation history so the voice AI can follow up on prior exchanges
      const history = messages
        .filter(m => m.content && m.content !== '🎤 Voice message')
        .map(m => ({ role: m.role, content: m.content }))
      if (history.length > 0) {
        formData.append('history', JSON.stringify(history))
      }

      // Send to API for processing
      setProcessingStage('transcribing')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90000) // 90s for STT + LLM + TTS pipeline
      const res = await fetch("/api/chat/voice", {
        method: "POST",
        body: formData,
        signal: controller.signal
      }).finally(() => clearTimeout(timer))


      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        // Empty transcription (silence) — silently restart recording
        if (res.status === 422 && (errorData as any).error === 'Empty transcription') {
          console.log('Empty transcription — restarting recording')
          // Remove the user message we just added (it was silence)
          setMessages(messages)
          setIsProcessing(false)
          setProcessingStage(null)
          if (isVoiceMode && !isRecording) {
            setTimeout(() => startRecording(), 300)
          }
          return
        }
        console.error('❌ API error:', errorData)
        if ((errorData as any).reply && String((errorData as any).reply).toLowerCase().includes('quota')) {
          throw new Error("Voice service quota exceeded. Please try again later.")
        }
        throw new Error(`Voice chat request failed: ${res.status} ${res.statusText}`)
      }

      // Read streaming NDJSON response — transcript → text → audio
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let textData: any = null
      let audioData: any = null
      let updatedUserMessages = newMessages // track messages with transcription update
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Parse complete NDJSON lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // keep incomplete line in buffer
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line)
              if (chunk.type === 'transcript') {
                // Replace "Voice message" placeholder with actual transcription
                setProcessingStage('thinking')
                updatedUserMessages = updatedUserMessages.map((m, idx) =>
                  idx === updatedUserMessages.length - 1 && m.role === 'user'
                    ? { ...m, content: chunk.text }
                    : m
                )
                setMessages(updatedUserMessages)
              } else if (chunk.type === 'text') {
                textData = chunk
                // Show text reply immediately — don't wait for audio
                setProcessingStage('speaking')
                const assistantMessage: Message = {
                  role: "assistant" as const,
                  content: chunk.reply,
                  audio: undefined,
                  timestamp: Date.now(),
                  createdTask: chunk.createdTask || null,
                }
                setMessages([...updatedUserMessages, assistantMessage])
                setIsProcessing(false)
                // Handle commands
                if (assistantMessage.createdTask?.id) {
                  window.dispatchEvent(new CustomEvent('lifeboard:task-injected', { detail: { task: assistantMessage.createdTask } }))
                }
                if (assistantMessage.createdTask || chunk.commandsExecuted) {
                  notifyTasksUpdated([1000, 3000])
                }
              } else if (chunk.type === 'audio') {
                audioData = chunk
              }
            } catch { /* ignore parse errors for partial lines */ }
          }
        }
      }

      // Fallback: if no streaming body, try regular JSON parse
      if (!textData && !reader) {
        const data = await res.json()
        textData = { reply: data.reply, createdTask: data.createdTask, commandsExecuted: data.commandsExecuted }
        audioData = { audioUrl: data.audioUrl }
        const assistantMessage: Message = {
          role: "assistant" as const,
          content: data.reply,
          audio: data.audioUrl,
          timestamp: Date.now(),
          createdTask: data.createdTask || null,
        }
        setMessages([...newMessages, assistantMessage])
        if (assistantMessage.createdTask?.id) {
          window.dispatchEvent(new CustomEvent('lifeboard:task-injected', { detail: { task: assistantMessage.createdTask } }))
        }
        if (assistantMessage.createdTask || data.commandsExecuted) {
          notifyTasksUpdated([1000, 3000])
        }
      }

      // Play audio when it arrives (may already be available or arrive shortly after text)
      const audioUrl = audioData?.audioUrl
      if (audioUrl) {
        console.log('[Voice] Got audioUrl, length:', audioUrl.length, 'prefix:', audioUrl.slice(0, 30))

        // Stop any existing audio before playing new audio (prevents overlap)
        cancelTTS()

        setIsSpeaking(true)
        setProcessingStage(null)
        // NOTE: We intentionally do NOT set m.audio on assistant messages here.
        // The <audio controls> element in JSX is for user recordings only.
        // Playing via new Audio() avoids duplicate playback from both sources.
        const audio = new Audio(audioUrl)
        currentAudioRef.current = audio

        // Set output device if selected
        try {
          if (speakerDeviceId && typeof (audio as any).setSinkId === 'function') {
            await (audio as any).setSinkId(speakerDeviceId)
          }
        } catch (e) {
          console.warn('[Voice] Failed to set output device', e)
        }

        const restartRecordingAfterPlayback = () => {
          setIsSpeaking(false)
          currentAudioRef.current = null
          if (isVoiceMode) {
            // 1s delay lets speaker audio fully decay so the mic doesn't
            // pick up residual sound and trigger an immediate silence-send cycle
            setTimeout(() => {
              if (isVoiceMode && !isRecording && !isProcessing) startRecording()
            }, 1000)
          }
        }

        audio.onended = () => {
          console.log('[Voice] Audio playback ended')
          restartRecordingAfterPlayback()
        }
        audio.onerror = (e) => {
          console.error('[Voice] Audio playback error:', e)
          restartRecordingAfterPlayback()
        }
        audio.play().catch((playErr) => {
          console.error('[Voice] audio.play() failed:', playErr)
          restartRecordingAfterPlayback()
        })
      } else {
        console.log('[Voice] No audioUrl in response — text only')
        // No server audio — just show the text reply
        setIsProcessing(false)
        setProcessingStage(null)
        if (isVoiceMode && !isRecording) {
          setTimeout(() => {
            if (isVoiceMode && !isRecording && !isProcessing) startRecording()
          }, 1000)
        }
      }
    } catch (err: any) {
      console.error('Voice message error:', err)
      console.error('Error details:', err.message)
      const errorMessage = err.message || "Sorry, I couldn't process your voice message."
      setMessages([...messages, {
        role: "assistant",
        content: errorMessage,
        isError: true,
        timestamp: Date.now()
      }])
      setProcessingStage(null)

      // Restart recording even after error if in voice mode
      if (isVoiceMode && !isProcessing) {
        setTimeout(() => {
          if (isVoiceMode && !isRecording && !isProcessing) startRecording()
        }, 1000)
      }
    }
  }

  function cancelTTS() {
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    } finally {
      setIsSpeaking(false)
    }
  }

  function handleCloseChat() {
    cancelTTS()
    stopBargeMonitor()
    stopRealtime()
    if (isRecording) {
      stopRecording()
    }
    if (rtRemoteAudioRef.current) {
      rtRemoteAudioRef.current.pause()
      rtRemoteAudioRef.current.srcObject = null
    }
    setIsVoiceMode(false)
    setIsProcessing(false)
    setIsSpeaking(false)
    setIsOpen(false)
  }

  function handleQuickPrompt(prompt: string) {
    setInput(prompt)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function handleSend() {
    if (!input.trim()) return

    if (isOffline) {
      setMessages(prev => [...prev, { role: "assistant", content: "You appear to be offline. Please check your connection and try again.", isError: true, timestamp: Date.now() }])
      return
    }

    const newMessages: Message[] = [...messages, { role: "user", content: input, timestamp: Date.now() }]
    setMessages(newMessages)
    setInput("")
    setIsProcessing(true) // Show thinking indicator

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90000) // Increased to 90s for GPT-5 Pro (cold starts can be slow)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          tts: { voice: ttsVoice, speed: ttsRate }
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timer))
      if (!res.ok) throw new Error("Chat request failed")

      // Read streaming NDJSON — text arrives immediately, audio follows
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let textData: any = null
      let audioData: any = null
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line)
              if (chunk.type === 'text') {
                textData = chunk
                const assistantMessage: Message = {
                  role: "assistant" as const,
                  content: chunk.reply,
                  timestamp: Date.now(),
                  createdTask: chunk.createdTask || null,
                }
                setMessages([...newMessages, assistantMessage])
                setIsProcessing(false)
                if (assistantMessage.createdTask?.id) {
                  window.dispatchEvent(new CustomEvent('lifeboard:task-injected', { detail: { task: assistantMessage.createdTask } }))
                }
                if (assistantMessage.createdTask || chunk.commandsExecuted) {
                  notifyTasksUpdated([1000, 3000])
                }
              } else if (chunk.type === 'audio') {
                audioData = chunk
              }
            } catch { /* ignore partial line parse errors */ }
          }
        }
      }

      // Fallback: if no streaming body, try regular JSON parse
      if (!textData && !reader) {
        const data = await res.json()
        textData = data
        audioData = { audioUrl: data.audioUrl }
        const assistantMessage: Message = { role: "assistant", content: data.reply, timestamp: Date.now(), createdTask: data.createdTask || null }
        setMessages([...newMessages, assistantMessage])
        setIsProcessing(false)
        if (assistantMessage.createdTask?.id) {
          window.dispatchEvent(new CustomEvent('lifeboard:task-injected', { detail: { task: assistantMessage.createdTask } }))
        }
        if (assistantMessage.createdTask || data.commandsExecuted) {
          notifyTasksUpdated([1000, 3000])
        }
      }

      // Play TTS audio if present
      const audioUrl = audioData?.audioUrl
      if (audioUrl) {
        try {
          cancelTTS()
          setIsSpeaking(true)
          const audio = new Audio(audioUrl)
          currentAudioRef.current = audio
          audio.onended = () => {
            setIsSpeaking(false)
            currentAudioRef.current = null
            if (isVoiceMode && !isProcessing) {
              setTimeout(() => {
                if (isVoiceMode && !isRecording && !isProcessing) startRecording()
              }, 1000)
            }
          }
          audio.onerror = () => {
            setIsSpeaking(false)
            currentAudioRef.current = null
          }
          await audio.play().catch(() => {
            setIsSpeaking(false)
            currentAudioRef.current = null
          })
        } catch {
          // Server audio playback failed — just show text
        }
      }
    } catch (err) {
      console.error(err)
      lastFailedInputRef.current = newMessages[newMessages.length - 1]?.content || ''
      setMessages([...newMessages, { role: "assistant", content: "Sorry, something went wrong. Tap retry to try again.", isError: true, timestamp: Date.now() }])
      setIsProcessing(false)
    }
  }

  function handleRetry() {
    if (!lastFailedInputRef.current) return
    // Remove the error message and the failed user message
    const cleaned = messages.filter((_, i) => i < messages.length - 2)
    setMessages(cleaned)
    setInput(lastFailedInputRef.current)
    lastFailedInputRef.current = ''
    // Auto-send after a tick so the input is set
    setTimeout(() => handleSend(), 50)
  }

  function handleCopy(text: string, index: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    }).catch(() => {})
  }

  function handleClearChat() {
    setMessages([])
    lastFailedInputRef.current = ''
    try { localStorage.removeItem(CHAT_STORAGE_KEY) } catch {}
  }

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && !m.isError)
  const followUpChips = !isProcessing && messages.length > 0 ? getFollowUpChips(lastAssistantMsg) : []

  const handleCompleteTask = useCallback(async (messageIndex: number, taskId: string) => {
    try {
      const res = await fetch('/api/integrations/todoist/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })
      if (res.ok) {
        setMessages(prev => prev.map((msg, idx) => idx === messageIndex ? ({
          ...msg,
          createdTask: { ...(msg.createdTask as any), completed: true }
        }) : msg))
      }
    } catch {}
  }, [setMessages])

  const handleToggleSpeakReplies = useCallback(() => {
    setSpeakReplies(prev => {
      const next = !prev
      if (!next) cancelTTS()
      // In realtime mode, mute/unmute the remote audio
      if (rtRemoteAudioRef.current) {
        rtRemoteAudioRef.current.muted = !next
        rtRemoteAudioRef.current.volume = next ? 1 : 0
      }
      return next
    })
  }, [])

  const handleToggleSettings = useCallback(() => {
    setShowSettings(s => !s)
  }, [])

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-4 right-3 sm:right-4 z-50">
      <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="chat-panel"
          ref={chatPanelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Chat assistant"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-[90vw] max-w-sm sm:w-80 bg-white shadow-xl rounded-xl flex flex-col h-[min(70vh,480px)] md:h-[420px] relative pb-[env(safe-area-inset-bottom)]"
        >
          <ChatHeader
            isVoiceMode={isVoiceMode}
            isRealtimeActive={isRealtimeActive}
            rtConnState={rtConnState}
            rtIceState={rtIceState}
            rtGatheringState={rtGatheringState}
            hasMessages={messages.length > 0}
            onClearChat={handleClearChat}
            onClose={handleCloseChat}
          />

          {/* Offline banner */}
          {isOffline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
              <WifiOff className="w-3 h-3" /> You are offline
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 && (
              <div className="bg-theme-primary-50 text-theme-text-primary rounded-lg p-3 text-xs space-y-2">
                <div className="font-medium text-theme-text-primary">Try asking:</div>
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="px-2 py-1 rounded-full bg-white text-[#5a4a3a] border border-theme-neutral-300 hover:bg-theme-surface-selected transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <ChatMessage
                key={m.id}
                message={m}
                index={i}
                messages={messages}
                copiedIndex={copiedIndex}
                onCopy={handleCopy}
                onRetry={handleRetry}
                onCompleteTask={handleCompleteTask}
              />
            ))}
            {/* Follow-up suggestion chips */}
            {followUpChips.length > 0 && !isProcessing && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {followUpChips.map(chip => (
                  <button
                    key={chip}
                    onClick={() => handleQuickPrompt(chip)}
                    className="px-2 py-1 rounded-full text-[11px] bg-theme-primary-50 text-[#5a4a3a] border border-theme-neutral-200 hover:bg-theme-surface-selected transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            {isProcessing && (
              <div className="text-left">
                <div className="inline-block rounded-lg px-3 py-2 bg-theme-brand-tint-light text-theme-text-primary">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-theme-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-theme-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-theme-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-xs text-theme-text-tertiary">
                      {processingStage === 'transcribing' ? 'Transcribing...' :
                       processingStage === 'thinking' ? 'Thinking...' :
                       processingStage === 'speaking' ? 'Generating audio...' :
                       'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            isVoiceMode={isVoiceMode}
            isRecording={isRecording}
            silenceProgress={silenceProgress}
            recordingDuration={recordingDuration}
            micLevel={micLevel}
            input={input}
            onInputChange={setInput}
            isProcessing={isProcessing}
            isSpeaking={isSpeaking}
            processingStage={processingStage}
            inputRef={inputRef}
            onToggleSettings={handleToggleSettings}
            speakReplies={speakReplies}
            onToggleSpeakReplies={handleToggleSpeakReplies}
            onToggleVoiceMode={toggleVoiceMode}
            onSend={handleSend}
          />

          {/* Hidden audio element for realtime playback */}
          <audio ref={rtRemoteAudioRef as any} className="hidden" autoPlay />

          {showSettings && (
            <ChatSettingsPanel
              panelRef={settingsPanelRef}
              onClose={() => setShowSettings(false)}
              useRealtime={useRealtime}
              onRealtimeChange={setUseRealtime}
              onDetectDevices={() => enumerateAudioDevices(true)}
              isEnumerating={isEnumerating}
              ttsVoice={ttsVoice}
              onVoiceChange={setTtsVoice}
              micDeviceId={micDeviceId}
              onMicChange={setMicDeviceId}
              devices={devices}
              speakerDeviceId={speakerDeviceId}
              onSpeakerChange={setSpeakerDeviceId}
              ttsRate={ttsRate}
              onRateChange={setTtsRate}
              isRealtimeActive={isRealtimeActive}
              rtConnState={rtConnState}
              rtIceState={rtIceState}
              rtGatheringState={rtGatheringState}
              rtReconnecting={rtReconnecting}
              onReconnect={reconnectRealtime}
            />
          )}
        </motion.div>
      ) : (
        <motion.button
          key="chat-fab"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-white shadow-warm rounded-full pl-3 pr-4 py-2 hover:shadow-warm-lg"
        >
          <MessageSquare className="w-5 h-5 text-theme-secondary" />
          <span className="text-sm text-theme-text-tertiary">Ask me anything</span>
        </motion.button>
      )}
      </AnimatePresence>
    </div>
  )
}
