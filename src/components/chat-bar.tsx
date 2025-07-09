"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, X, Send } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function ChatBar() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
                <span
                  className={`inline-block rounded-lg px-3 py-2 whitespace-pre-wrap max-w-[80%] ${
                    m.role === "user" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {m.content}
                </span>
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
            />
            <button onClick={handleSend} className="text-indigo-500" aria-label="Send message">
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
