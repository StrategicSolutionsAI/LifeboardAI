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
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // First, transcribe the audio using OpenAI Whisper
    let transcription = ''
    try {
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'text',
      })
      
      console.log('Transcribed audio:', transcription)
    } catch (transcribeError: any) {
      console.error('Transcription error:', transcribeError)
      
      // Check if it's a rate limit error in the catch block too
      if (transcribeError.message && transcribeError.message.includes('Too Many Requests')) {
        transcription = "I received your voice message but I'm currently experiencing high demand. Please try again in a moment, or feel free to type your message instead."
      } else {
        return NextResponse.json({ 
          error: 'Transcription error', 
          reply: "Sorry, I couldn't process your voice message. Please try again or use text chat."
        }, { status: 500 })
      }
    }

    // Fetch user preferences to give context
    const prefs = await getUserPreferencesServer()
    
    let systemContext = ''
    if (prefs) {
      const bucketSummary = Object.entries(prefs.widgets_by_bucket).map(([b, w]: [string, any[]]) => `${b}: ${w.map(x => x.name || x.type || 'widget').join(', ')}`).join('; ')
      
      const dynamicData: Record<string, string | number> = {}
      
      // Detect steps widget data source
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
          console.error(`Failed fetching ${stepsDataSource} metrics for voice chat context`, err)
        }
      }

      const dynamicString = Object.keys(dynamicData).length > 0 ? ` Current data: ${Object.entries(dynamicData).map(([k,v]) => `${k}: ${v}`).join(', ')}.` : ''
      systemContext = `The user has the following life buckets (tabs): ${prefs.life_buckets.join(', ')}. Widgets per bucket: ${bucketSummary}.${dynamicString}`
    }

    // Create OpenAI messages format with the transcribed audio
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...(systemContext ? [{ role: 'system' as const, content: systemContext }] : []),
      { role: 'user' as const, content: transcription }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: 1024,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response to your voice message.'
    let audioUrl = null // No audio generation for now

    return NextResponse.json({ 
      reply: reply || "I received your voice message, but I'm having trouble processing it right now.",
      audioUrl 
    })
    
  } catch (err: any) {
    console.error('Voice chat route error', err)
    return NextResponse.json({ 
      error: 'Internal error', 
      reply: "Sorry, I'm having trouble processing voice messages right now. Please try again or use text chat."
    }, { status: 500 })
  }
}