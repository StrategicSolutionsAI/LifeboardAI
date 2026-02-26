# Replicate Gemini 3.1 Pro Integration

This directory contains the Replicate API client for running Google's Gemini 3.1 Pro in LifeboardAI's chatbot.

## Setup

1. **Get your Replicate API token:**
   - Sign up at https://replicate.com
   - Go to your account settings
   - Copy your API token

2. **Add to environment variables:**
   ```bash
   REPLICATE_API_TOKEN=your_token_here
   ```

3. **The chatbot will automatically use Gemini 3.1 Pro** via Replicate with OpenAI GPT-4o-mini as a fallback.

## Usage

The chatbot API route (`/src/app/api/chat/route.ts`) uses Gemini 3.1 Pro by default:

```typescript
import { runGemini } from '@/lib/replicate/client';

const reply = await runGemini({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 2048,
});
```

## Features

- **Primary Model**: Gemini 3.1 Pro via Replicate
- **Fallback**: OpenAI GPT-4o-mini if Replicate fails
- **Task Creation**: Supports Lifeboard task commands
- **Context Aware**: Includes user's buckets, widgets, and dynamic data
- **TTS Support**: OpenAI TTS for voice responses
- **Thinking Levels**: Configurable reasoning depth (low/medium/high)

## API Reference

### `runGemini(options)`

Runs Gemini 3.1 Pro and returns the complete response.

**Parameters:**
- `messages`: Array of message objects with `role` and `content`
- `temperature`: (optional) 0.0-2.0, default 0.7
- `max_tokens`: (optional) Maximum output tokens, default 2048 (up to 65,535)
- `top_p`: (optional) Nucleus sampling parameter, default 0.95
- `thinking_level`: (optional) Reasoning depth: 'low', 'medium', or 'high', default 'medium'

**Returns:** Promise<string> - The model's response text

### `streamGemini(options)`

Streams Gemini 3.1 Pro responses for real-time output.

**Parameters:** Same as `runGemini`

**Returns:** AsyncIterable<string> - Streaming response chunks

## Error Handling

If Replicate fails (network issues, rate limits, etc.), the chatbot automatically falls back to OpenAI's GPT-4o-mini to ensure uninterrupted service.

## Cost Considerations

- Gemini 3.1 Pro runs on Replicate's infrastructure
- Pricing: $2/$12 per million tokens (input/output) for <=200k context, $4/$18 for >200k
- Monitor usage in your Replicate dashboard
- OpenAI fallback uses your OpenAI API key

## Model Information

- **Model**: google/gemini-3.1-pro
- **Provider**: Replicate
- **Context Window**: 1M tokens
- **Max Output**: 65,535 tokens
- **Documentation**: https://replicate.com/google/gemini-3.1-pro
