export interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
  audio?: string // Optional audio URL for voice messages
  isError?: boolean
  timestamp?: number
  createdTask?: {
    id?: string
    content?: string
    due?: { date?: string }
    completed?: boolean
  } | null
}
