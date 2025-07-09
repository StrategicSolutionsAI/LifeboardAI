import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: { role: 'user' | 'assistant'; content: string }[] }

    // Ensure at least one user message
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content?.trim() || 'Sorry, I have no response.'
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('Chat route error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
