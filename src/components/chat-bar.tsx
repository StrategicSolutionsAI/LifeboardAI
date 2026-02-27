"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageSquare, X, Send, Mic, Volume2, VolumeX, Settings } from "lucide-react"
import { invalidateTaskCaches } from "@/hooks/use-data-cache"

interface Message {
  role: "user" | "assistant"
  content: string
  audio?: string // Optional audio URL for voice messages
  createdTask?: {
    id?: string
    content?: string
    due?: { date?: string }
    completed?: boolean
  } | null
}

export function ChatBar() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [ttsVoice, setTtsVoice] = useState<string>('Chloe')
  const [ttsRate, setTtsRate] = useState<number>(1.0)
  const [useRealtime, setUseRealtime] = useState<boolean>(true)
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
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const volumeCheckRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const helloTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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
  const inputRef = useRef<HTMLInputElement | null>(null)

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

  // Helper to aggressively clean filler phrases from assistant text so we don't
  // accidentally create tasks like "All . You've got a reminder ."
  function cleanAssistantContent(raw: string): string {
    let s = raw
      .replace(/\b(all\s*set|got\s*it|no\s*problem|okay|ok|sure|done|noted)\b[.!]?\s*/ig, ' ')
      .replace(/\byou(?:'|’)?ve\s+got\s+a\s+reminder(?:\s+for)?\b/ig, ' ')
      .replace(/\bi(?:'|’)?ll\s+note\s+(?:that|this)(?:\s+down)?(?:\s+for\s+you)?\b[.!]?\s*/ig, ' ')
      .replace(/^\s*all\s*[.!]?\s*/i, ' ')
      .replace(/\s*[.?!]\s*/g, ' ') // collapse stray punctuation
      .replace(/\s{2,}/g, ' ')
      .trim()
    return s
  }

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

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [isOpen])

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
        setMessages(prev => [...prev, { role: "assistant", content: "Hi Dalit, let me know if I can help you with anything" }])
        // Reschedule for next day
        scheduleHello()
      }, msUntil)
    }

    scheduleHello()
    return () => {
      if (helloTimeoutRef.current) clearTimeout(helloTimeoutRef.current)
    }
  }, [])

  // Silence detection function
  function detectSilence() {
    if (!analyserRef.current) {
      console.warn('⚠️ No analyser available for silence detection')
      return
    }

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    // Calculate RMS (Root Mean Square) for better volume detection
    const rms = Math.sqrt(dataArray.reduce((sum, value) => sum + value * value, 0) / bufferLength)
    const threshold = 15 // Amplitude threshold
    
    // Log volume for debugging (less frequently)
    if (Math.random() < 0.1) { // Only log 10% of the time to reduce spam
    }
    
    if (rms < threshold) {
      // Start silence timer if not already started
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          stopRecording()
        }, 1000) // 1 second of silence for snappier flow
      }
    } else {
      // Clear silence timer if sound detected
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    }
    
    // Continue monitoring if still recording
    if (isRecording) {
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

  // When AI starts/stops speaking in voice mode, toggle barge monitor (disabled during realtime)
  useEffect(() => {
    if (isVoiceMode && isSpeaking && !isRealtimeActive) {
      startBargeMonitor()
    } else {
      stopBargeMonitor()
    }
    return () => { /* no-op */ }
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
      setIsRecording(true)
      
      // Start silence detection
      detectSilence()
      
    } catch (error: any) {
      console.error('❌ Error accessing microphone:', error)
      console.error('Error details:', {
        name: error?.name,
        message: error?.message,
        micDeviceId,
        hasRequestedDeviceAccess
      })
      
      // Provide more helpful error messages based on the error type
      let errorMessage = 'Microphone access error. '
      
      if (error?.name === 'NotAllowedError' || error?.message?.includes('Permission denied')) {
        errorMessage += 'Permission denied. To use voice mode:\n\n' +
          '1. Click the 🔒 or ⓘ icon in your browser\'s address bar\n' +
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
      setIsVoiceMode(false)
      setIsRecording(false)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  function toggleVoiceMode() {
    
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
    try {
      
      // Always send to server for transcription (works across browsers)
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice-message.webm')

      // Add voice message to chat
      const newMessages: Message[] = [...messages, { 
        role: "user", 
        content: "🎤 Voice message", 
        audio: URL.createObjectURL(audioBlob) 
      }]
      setMessages(newMessages)

      // Include TTS preferences for server TTS
      formData.append('voice', ttsVoice)
      formData.append('speed', String(ttsRate))

      // Send to API for processing
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      const res = await fetch("/api/chat/voice", {
        method: "POST",
        body: formData,
        signal: controller.signal
      }).finally(() => clearTimeout(timer))


      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('❌ API error:', errorData)
        if ((errorData as any).reply && String((errorData as any).reply).toLowerCase().includes('quota')) {
          throw new Error("OpenAI quota exceeded. Please add credits to your OpenAI account or I can add browser-based speech recognition instead.")
        }
        throw new Error(`Voice chat request failed: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()

      const assistantMessage: Message = {
        role: "assistant" as const,
        content: data.reply,
        audio: data.audioUrl,
        createdTask: data.createdTask || null,
      }
      setMessages([...newMessages, assistantMessage])
      // If a task was created, inject it optimistically into the task list
      if (assistantMessage.createdTask?.id) {
        window.dispatchEvent(new CustomEvent('lifeboard:task-injected', { detail: { task: assistantMessage.createdTask } }))
      }
      // Broadcast a global refresh if any commands were executed (tasks, calendar, shopping)
      if (assistantMessage.createdTask || data.commandsExecuted) {
        notifyTasksUpdated([1000, 3000])
      }

      // Auto-play OpenAI TTS audio if available and handle continuous conversation
      // Play audio response (server TTS or browser TTS fallback)
      if (data.audioUrl) {
        setIsSpeaking(true)
        const audio = new Audio(data.audioUrl)
        currentAudioRef.current = audio

        audio.onended = () => {
          setIsSpeaking(false)
          currentAudioRef.current = null
          if (isVoiceMode && !isProcessing) {
            setTimeout(() => {
              if (isVoiceMode && !isRecording && !isProcessing) startRecording()
            }, 500)
          }
        }
        audio.onerror = () => {
          setIsSpeaking(false)
          currentAudioRef.current = null
          if (isVoiceMode && !isProcessing) {
            setTimeout(() => {
              if (isVoiceMode && !isRecording && !isProcessing) startRecording()
            }, 500)
          }
        }
        audio.play().catch(() => {
          setIsSpeaking(false)
          currentAudioRef.current = null
          if (isVoiceMode && !isProcessing) {
            setTimeout(() => {
              if (isVoiceMode && !isRecording && !isProcessing) startRecording()
            }, 500)
          }
        })
      } else {
        // No server audio—use browser TTS so the convo stays natural
        speakText(data.reply)
      }
    } catch (err: any) {
      console.error('Voice message error:', err)
      console.error('Error details:', err.message)
      const errorMessage = err.message || "Sorry, I couldn't process your voice message."
      setMessages([...messages, { 
        role: "assistant", 
        content: errorMessage
      }])
      
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
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

  function speakText(text: string) {
    if (!speakReplies || !text) return
    cancelTTS()

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text)
      // Apply basic settings to browser TTS
      utter.rate = Math.min(4, Math.max(0.25, ttsRate || 1))
      ttsUtteranceRef.current = utter
      setIsSpeaking(true)

      utter.onend = () => {
        setIsSpeaking(false)
        ttsUtteranceRef.current = null
        if (isVoiceMode && !isProcessing) {
          setTimeout(() => {
            if (isVoiceMode && !isRecording && !isProcessing) startRecording()
          }, 500)
        }
      }
      utter.onerror = () => {
        setIsSpeaking(false)
        ttsUtteranceRef.current = null
        if (isVoiceMode && !isProcessing) {
          setTimeout(() => {
            if (isVoiceMode && !isRecording && !isProcessing) startRecording()
          }, 500)
        }
      }

      window.speechSynthesis.speak(utter)
    }
  }

  async function handleSend() {
    if (!input.trim()) return

    const newMessages: Message[] = [...messages, { role: "user", content: input }]
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
      const data = await res.json()
      const assistantMessage: Message = { role: "assistant", content: data.reply, audio: data.audioUrl, createdTask: data.createdTask || null }
      setMessages([...newMessages, assistantMessage])
      setIsProcessing(false) // Hide thinking indicator
      // If a task was created, inject it optimistically into the task list
      if (assistantMessage.createdTask?.id) {
        window.dispatchEvent(new CustomEvent('lifeboard:task-injected', { detail: { task: assistantMessage.createdTask } }))
      }
      // Broadcast a global refresh if any commands were executed (tasks, calendar, shopping)
      if (assistantMessage.createdTask || data.commandsExecuted) {
        notifyTasksUpdated([1000, 3000])
      }

      // Prefer server TTS audio if present; otherwise use browser TTS
      if (data.audioUrl) {
        try {
          setIsSpeaking(true)
          const audio = new Audio(data.audioUrl)
          currentAudioRef.current = audio
          audio.onended = () => {
            setIsSpeaking(false)
            currentAudioRef.current = null
            // Only auto-resume listening if in voice mode
            if (isVoiceMode && !isProcessing) {
              setTimeout(() => {
                if (isVoiceMode && !isRecording && !isProcessing) startRecording()
              }, 500)
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
          speakText(data.reply)
        }
      } else {
        speakText(data.reply)
      }
    } catch (err) {
      console.error(err)
      setMessages([...newMessages, { role: "assistant", content: "Sorry, something went wrong." }])
      setIsProcessing(false) // Hide thinking indicator on error
    }
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-3 sm:right-4 z-50">
      {isOpen ? (
        <div className="w-[90vw] max-w-sm sm:w-80 bg-white shadow-xl rounded-xl flex flex-col h-[70vh] md:h-96 relative">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 font-medium text-sm text-[#4a5568]">
              <MessageSquare className="w-4 h-4 text-[#bb9e7b]" /> Chat
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
            <button onClick={handleCloseChat} aria-label="Close chat">
              <X className="w-4 h-4 text-[#8e99a8]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm">
            {messages.length === 0 && (
              <div className="bg-[#fdf8f6] text-[#314158] rounded-lg p-3 text-xs space-y-2">
                <div className="font-medium text-[#314158]">Try asking:</div>
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="px-2 py-1 rounded-full bg-white text-[#9a7b5a] border border-[#dbd6cf] hover:bg-[#f5ede4] transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block rounded-lg px-3 py-2 whitespace-pre-wrap max-w-[80%] ${
                    m.role === "user" ? "bg-[#bb9e7b] text-white" : "bg-[rgba(183,148,106,0.08)] text-[#314158]"
                  }`}
                >
                  {m.content}
                  {m.audio && (
                    <div className="mt-2">
                      <audio controls className="w-full max-w-[200px]">
                        <source src={m.audio} type="audio/webm" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  {m.createdTask && m.role === 'assistant' && (
                    <div className="mt-2 border border-[#dbd6cf] rounded-md bg-white text-[#314158] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs">
                          <div className="font-medium">{m.createdTask.content || 'New task'}</div>
                          {m.createdTask.due?.date && (
                            <div className="text-[#8e99a8]">Due {m.createdTask.due.date}</div>
                          )}
                        </div>
                        {!m.createdTask.completed ? (
                          <button
                            onClick={async () => {
                              const taskId = (m.createdTask as any)?.id
                              if (!taskId) return
                              try {
                                const res = await fetch('/api/integrations/todoist/tasks/complete', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ taskId: String(taskId) })
                                })
                                if (res.ok) {
                                  setMessages(prev => prev.map((msg, idx) => idx === i ? ({
                                    ...msg,
                                    createdTask: { ...(msg.createdTask as any), completed: true }
                                  }) : msg))
                                }
                              } catch {}
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
              </div>
            ))}
            {isProcessing && (
              <div className="text-left">
                <div className="inline-block rounded-lg px-3 py-2 bg-[rgba(183,148,106,0.08)] text-[#314158]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#bb9e7b] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-[#bb9e7b] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-[#bb9e7b] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-xs text-[#8e99a8]">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t flex items-center gap-2 px-3 py-2 relative">
            <input
              type="text"
              className="flex-1 text-sm outline-none placeholder-[#8e99a8]"
              placeholder={
                isVoiceMode
                  ? (isSpeaking ? "AI is speaking…" :
                     isProcessing ? "Processing…" :
                     isRecording ? "Listening… (you can also type)" :
                     "Voice mode active (you can also type)")
                  : "Type a message…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend()
              }}
              ref={inputRef}
            />
            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(s => !s)}
              className="text-[#8e99a8]/70 hover:text-[#9a7b5a]"
              aria-label="TTS settings"
              title="Voice settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {/* Speak Replies Toggle */}
            <button
              onClick={() => {
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
              }}
              className={`transition-colors ${speakReplies ? 'text-[#9a7b5a] bg-[#fdf8f6] rounded-full p-1' : 'text-[#8e99a8]/70 hover:text-[#9a7b5a]'}`}
              aria-label={speakReplies ? 'Mute spoken replies' : 'Enable spoken replies'}
              title={speakReplies ? 'Spoken replies on' : 'Spoken replies off'}
            >
              {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Voice Mode Toggle */}
            <button 
              onClick={toggleVoiceMode}
              className={`transition-colors ${
                isVoiceMode 
                  ? 'text-green-500 bg-green-50 rounded-full p-1' 
                  : 'text-[#8e99a8]/70 hover:text-[#9a7b5a]'
              }`}
              aria-label={isVoiceMode ? "Exit voice mode" : "Start voice conversation"}
            >
              {isVoiceMode ? (
                <div className="flex items-center gap-1">
                  {isSpeaking ? (
                    <div className="w-2 h-2 bg-[#bb9e7b] rounded-full animate-pulse"></div>
                  ) : isProcessing ? (
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  ) : isRecording ? (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  ) : (
                    <div className="w-2 h-2 bg-[#b8b0a8] rounded-full"></div>
                  )}
                  <Mic className="w-4 h-4" />
                </div>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
            <button onClick={handleSend} className="text-[#bb9e7b]" aria-label="Send message">
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Hidden audio element for realtime playback */}
          <audio ref={rtRemoteAudioRef as any} className="hidden" autoPlay />

          {/* Settings Panel */}
          {showSettings && (
            <div className="absolute bottom-14 right-3 bg-white border shadow-warm-lg rounded-md p-3 w-64 z-50">
              <div className="text-xs font-medium text-[#4a5568] mb-2">Voice Settings</div>
              <label className="flex items-center justify-between mb-3 text-xs text-[#4a5568]">
                <span>Realtime voice (beta)</span>
                <input
                  type="checkbox"
                  checked={useRealtime}
                  onChange={(e) => setUseRealtime(e.target.checked)}
                />
              </label>
              <div className="mb-3">
                <button
                  onClick={() => enumerateAudioDevices(true)}
                  className="text-[11px] text-[#6b7688] hover:text-[#314158] underline"
                >
                  {isEnumerating ? 'Detecting devices…' : 'Detect audio devices'}
                </button>
              </div>
              <label className="block mb-2">
                <span className="text-xs text-[#8e99a8]">Voice</span>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                >
                  {['Chloe','Evelyn','Laura','Madison','Anaya','Abigail','Meera','Marisol','Lucy','Aaron','Ethan','Brian','Gordon','Andy','Dylan','Archer','Emmanuel','Gavin','Ivan','Walter'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="block mb-2">
                <span className="text-xs text-[#8e99a8]">Microphone</span>
                <select
                  value={micDeviceId}
                  onChange={(e) => setMicDeviceId(e.target.value)}
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">System default</option>
                  {devices.filter(d => d.kind === 'audioinput').map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                  ))}
                </select>
                {micDeviceId && /iphone|continuity/i.test((devices.find(d=>d.deviceId===micDeviceId)?.label)||'') && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">Selected mic appears to be an iPhone/Continuity device. If you see macOS “Audio Disconnected” alerts, choose a built‑in or USB mic.</div>
                )}
              </label>
              <label className="block mb-3">
                <span className="text-xs text-[#8e99a8]">Speaker</span>
                <select
                  value={speakerDeviceId}
                  onChange={(e) => setSpeakerDeviceId(e.target.value)}
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
                    className="text-[11px] px-2 py-1 rounded border hover:bg-[#faf8f5]"
                  >
                    Test beep
                  </button>
                </div>
              </label>
              <label className="block">
                <div className="flex items-center justify-between text-xs text-[#8e99a8]">
                  <span>Speaking rate</span>
                  <span>{ttsRate.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={ttsRate}
                  onChange={(e) => setTtsRate(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <div className="mt-3 border-t pt-2">
                <div className="text-[10px] text-[#8e99a8]">Debug</div>
                <div className="text-[10px] text-[#8e99a8]">Realtime: {isRealtimeActive ? 'active' : 'inactive'}</div>
                {isRealtimeActive && (
                  <div className="text-[10px] text-[#8e99a8]">
                    conn:{rtConnState || '—'} ice:{rtIceState || '—'} gather:{rtGatheringState || '—'}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={reconnectRealtime}
                    className={`text-xs px-2 py-1 rounded border ${rtReconnecting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#faf8f5]'}`}
                    disabled={rtReconnecting}
                  >
                    {rtReconnecting ? 'Reconnecting…' : 'Reconnect Realtime'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-white shadow-warm rounded-full pl-3 pr-4 py-2 hover:shadow-warm-lg"
        >
          <MessageSquare className="w-5 h-5 text-[#bb9e7b]" />
          <span className="text-sm text-[#8e99a8]">Ask me anything</span>
        </button>
      )}
    </div>
  )
}
