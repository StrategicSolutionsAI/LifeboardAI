import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getUserPreferencesServer } from '@/lib/user-preferences-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }
  return new OpenAI({ apiKey })
}

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAI()
    const { messages } = await req.json() as { messages: { role: 'user' | 'assistant'; content: string }[] }

    // Ensure at least one user message
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 })
    }

    // Fetch user preferences to give Claude context about tabs and widgets
    const prefs = await getUserPreferencesServer()

    let systemContext = ''
if (prefs) {
  // Gather widget metadata
  const bucketSummary = Object.entries(prefs.widgets_by_bucket).map(([b, w]: [string, any[]]) => `${b}: ${w.map(x => x.name || x.type || 'widget').join(', ')}`).join('; ')

  // Map to hold dynamic data values we can fetch quickly
  const dynamicData: Record<string, string | number> = {}

  // Detect a steps widget and its data source
  let stepsDataSource: 'fitbit' | 'googlefit' | null = null
  for (const widgets of Object.values(prefs.widgets_by_bucket)) {
    for (const w of widgets as any[]) {
      if (w.id === 'steps') {
        const ds = (w as any).dataSource ?? 'fitbit'
        stepsDataSource = ds === 'googlefit' ? 'googlefit' : 'fitbit'
        break
      }
    }
    if (stepsDataSource) break
  }

  if (stepsDataSource) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const metricsUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/integrations/${stepsDataSource}/metrics?date=${today}`
      const metricsRes = await fetch(metricsUrl, {
        headers: {
          cookie: req.headers.get('cookie') || ''
        },
        cache: 'no-store'
      })
      if (metricsRes.ok) {
        const metricsJson = await metricsRes.json()
        if (typeof metricsJson.steps === 'number') {
          dynamicData['daily_steps'] = metricsJson.steps
        }
      }
    } catch (err) {
      console.error(`Failed fetching ${stepsDataSource} metrics for chat context`, err)
    }
  }

  const dynamicString = Object.keys(dynamicData).length > 0 ? ` Current data: ${Object.entries(dynamicData).map(([k,v]) => `${k}: ${v}`).join(', ')}.` : ''

  systemContext = `System: The user has the following life buckets (tabs): ${prefs.life_buckets.join(', ')}. Widgets per bucket: ${bucketSummary}.${dynamicString}`
}

    // Create OpenAI messages format
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      ...messages.map(({ role, content }) => ({ role: role as 'user' | 'assistant', content }))
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 1024,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('Chat route error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
