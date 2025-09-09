"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, X, Send, Mic, MicOff } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
  audio?: string // Optional audio URL for voice messages
}

export function ChatBar() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const helloTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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

  // Voice recording functions
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      audioChunksRef.current = []
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
        console.log('Audio recorded, size:', audioBlob.size, 'bytes')
        await handleVoiceMessage(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }
      
      // Record in chunks to get better data
      recorder.start(100) // Record data every 100ms
      setMediaRecorder(recorder)
      setIsRecording(true)
      
      console.log('Recording started...')
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Unable to access microphone. Please check your permissions.')
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      console.log('Stopping recording...')
      mediaRecorder.stop()
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  async function handleVoiceMessage(audioBlob: Blob) {
    try {
      // First try browser-based speech recognition as fallback
      let transcription = ''
      
      // Check if browser supports speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        // For now, send to server - later we can add browser fallback
        const formData = new FormData()
        formData.append('audio', audioBlob, 'voice-message.webm')
        
        // Add voice message to chat
        const newMessages: Message[] = [...messages, { 
          role: "user", 
          content: "🎤 Voice message", 
          audio: URL.createObjectURL(audioBlob) 
        }]
        setMessages(newMessages)

        // Send to API for processing
        const res = await fetch("/api/chat/voice", {
          method: "POST",
          body: formData
        })
        
        if (!res.ok) {
          const errorData = await res.json()
          if (errorData.reply && errorData.reply.includes('quota')) {
            throw new Error("OpenAI quota exceeded. Please add credits to your OpenAI account or I can add browser-based speech recognition instead.")
          }
          throw new Error("Voice chat request failed")
        }
        
        const data = await res.json()
        
        setMessages([...newMessages, { 
          role: "assistant", 
          content: data.reply,
          audio: data.audioUrl
        }])
        
        // Add text-to-speech for AI response
        if (data.reply && 'speechSynthesis' in window) {
          console.log('Speaking AI response:', data.reply)
          const utterance = new SpeechSynthesisUtterance(data.reply)
          utterance.rate = 0.9
          utterance.pitch = 1
          utterance.volume = 0.8
          
          utterance.onstart = () => console.log('Speech started')
          utterance.onend = () => console.log('Speech ended')
          utterance.onerror = (event) => console.error('Speech error:', event)
          
          // Cancel any existing speech first
          window.speechSynthesis.cancel()
          
          // Small delay to ensure cancel is processed
          setTimeout(() => {
            window.speechSynthesis.speak(utterance)
          }, 100)
        } else {
          console.log('Speech synthesis not available')
        }
      } else {
        throw new Error("Speech recognition not supported in this browser")
      }
    } catch (err: any) {
      console.error('Voice message error:', err)
      console.error('Error details:', err.message)
      const errorMessage = err.message || "Sorry, I couldn't process your voice message."
      setMessages([...messages, { 
        role: "assistant", 
        content: errorMessage
      }])
    }
  }

  async function handleSend() {
    if (!input.trim()) return

    const newMessages: Message[] = [...messages, { role: "user", content: input }]
    setMessages(newMessages)
    setInput("")

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) })
      })
      if (!res.ok) throw new Error("Chat request failed")
      const data = await res.json()
      setMessages([...newMessages, { role: "assistant", content: data.reply }])
    } catch (err) {
      console.error(err)
      setMessages([...newMessages, { role: "assistant", content: "Sorry, something went wrong." }])
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="w-80 bg-white shadow-xl rounded-xl flex flex-col h-96">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 font-medium text-sm text-gray-700">
              <MessageSquare className="w-4 h-4 text-indigo-500" /> Chat
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block rounded-lg px-3 py-2 whitespace-pre-wrap max-w-[80%] ${
                    m.role === "user" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-800"
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
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t flex items-center gap-2 px-3 py-2">
            <input
              type="text"
              className="flex-1 text-sm outline-none placeholder-gray-400"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend()
              }}
              disabled={isRecording}
            />
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-indigo-500'}`}
              aria-label={isRecording ? "Stop recording" : "Start voice recording"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button onClick={handleSend} className="text-indigo-500" aria-label="Send message" disabled={isRecording}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-white shadow-md rounded-full pl-3 pr-4 py-2 hover:shadow-lg"
        >
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <span className="text-sm text-gray-500">Ask me anything</span>
        </button>
      )}
    </div>
  )
}
