# Replicate GPT-5 Pro Integration

This directory contains the Replicate API client for running GPT-5 Pro in LifeboardAI's chatbot.

## Setup

1. **Get your Replicate API token:**
   - Sign up at https://replicate.com
   - Go to your account settings
   - Copy your API token

2. **Add to environment variables:**
   ```bash
   REPLICATE_API_TOKEN=your_token_here
   ```

3. **The chatbot will automatically use GPT-5 Pro** via Replicate with OpenAI as a fallback.

## Usage

The chatbot API route (`/src/app/api/chat/route.ts`) now uses GPT-5 Pro by default:

```typescript
import { runGPT5Pro } from '@/lib/replicate/client';

const reply = await runGPT5Pro({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 1024,
});
```

## Features

- **Primary Model**: GPT-5 Pro via Replicate
- **Fallback**: OpenAI GPT-4o-mini if Replicate fails
- **Task Creation**: Supports Lifeboard task commands
- **Context Aware**: Includes user's buckets, widgets, and dynamic data
- **TTS Support**: OpenAI TTS for voice responses

## API Reference

### `runGPT5Pro(options)`

Runs GPT-5 Pro and returns the complete response.

**Parameters:**
- `messages`: Array of message objects with `role` and `content`
- `temperature`: (optional) 0.0-1.0, default 0.7
- `max_tokens`: (optional) Maximum tokens to generate, default 1024
- `top_p`: (optional) Nucleus sampling parameter, default 0.9

**Returns:** Promise<string> - The model's response text

### `streamGPT5Pro(options)`

Streams GPT-5 Pro responses for real-time output.

**Parameters:** Same as `runGPT5Pro`

**Returns:** AsyncIterable<string> - Streaming response chunks

## Error Handling

If Replicate fails (network issues, rate limits, etc.), the chatbot automatically falls back to OpenAI's GPT-4o-mini to ensure uninterrupted service.

## Cost Considerations

- GPT-5 Pro runs on Replicate's infrastructure
- Pricing: https://replicate.com/openai/gpt-5-pro
- Monitor usage in your Replicate dashboard
- OpenAI fallback uses your OpenAI API key

## Model Information

- **Model**: openai/gpt-5-pro
- **Provider**: Replicate
- **Documentation**: https://replicate.com/openai/gpt-5-pro
