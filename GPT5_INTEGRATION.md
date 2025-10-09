# GPT-5 Pro Integration Complete ✅

The LifeboardAI chatbot now uses **GPT-5 Pro via Replicate** as the primary language model.

## What Changed

### Files Created:
1. **`/src/lib/replicate/client.ts`** - Replicate API client with GPT-5 Pro integration
2. **`/src/lib/replicate/README.md`** - Documentation for the integration

### Files Modified:
1. **`/src/app/api/chat/route.ts`** - Updated to use GPT-5 Pro with OpenAI fallback
2. **`.env.example`** - Updated documentation for API tokens

## Setup Instructions

### 1. Get Your Replicate API Token
- Visit https://replicate.com
- Sign up or log in
- Go to Account Settings → API Tokens
- Copy your API token

### 2. Add to Environment Variables
Add to your `.env.local` file:
```bash
REPLICATE_API_TOKEN=r8_your_token_here
```

### 3. Test the Chatbot
1. Start the development server: `npm run dev`
2. Open the dashboard
3. Click the chat icon in the bottom right
4. Send a message to test GPT-5 Pro

## Features

✅ **Primary Model**: GPT-5 Pro via Replicate  
✅ **Automatic Fallback**: OpenAI GPT-4o-mini if Replicate fails  
✅ **Task Creation**: Full support for Lifeboard task commands  
✅ **Context Aware**: Includes user buckets, widgets, and live data  
✅ **Voice Support**: OpenAI TTS for audio responses  
✅ **Error Handling**: Graceful degradation to OpenAI  

## How It Works

1. **User sends message** → Chat API receives request
2. **GPT-5 Pro processes** → Replicate runs the model
3. **Response returned** → Includes task commands if applicable
4. **Tasks created** → Automatically added to Todoist/Supabase
5. **TTS generated** → OpenAI creates audio response (if enabled)

## Architecture

```
User Message
    ↓
Chat API (/api/chat)
    ↓
GPT-5 Pro (Replicate) ──[fails]──→ GPT-4o-mini (OpenAI)
    ↓
Response + Task Commands
    ↓
Task Creation (Todoist/Supabase)
    ↓
TTS Audio (OpenAI)
    ↓
Response to User
```

## Testing

### Test Basic Chat:
```
User: "Hello, how are you?"
Expected: Normal conversational response from GPT-5 Pro
```

### Test Task Creation:
```
User: "Add a task to call John tomorrow at 3pm in Work"
Expected: Task created + confirmation message
```

### Test Context Awareness:
```
User: "What are my buckets?"
Expected: Lists your configured life buckets
```

## Monitoring

- **Replicate Dashboard**: https://replicate.com/account/billing
- **Check Logs**: Look for "GPT-5 Pro error, falling back to OpenAI" if issues occur
- **Fallback Indicator**: Console logs will show if OpenAI fallback is used

## Cost Comparison

| Model | Provider | Cost per 1M tokens |
|-------|----------|-------------------|
| GPT-5 Pro | Replicate | Check Replicate pricing |
| GPT-4o-mini | OpenAI | ~$0.15 input / $0.60 output |

## Troubleshooting

### "REPLICATE_API_TOKEN is not set"
- Add token to `.env.local`
- Restart development server

### Chatbot uses OpenAI instead of Replicate
- Check console logs for error messages
- Verify Replicate token is valid
- Check Replicate API status

### Task creation not working
- Verify Todoist integration is connected
- Check console for API errors
- Ensure task command format is correct

## Next Steps

- [ ] Monitor Replicate usage and costs
- [ ] Test with various prompts and scenarios
- [ ] Adjust temperature/max_tokens if needed
- [ ] Consider streaming responses for better UX
- [ ] Add usage analytics

## Support

- **Replicate Docs**: https://replicate.com/docs
- **GPT-5 Pro Model**: https://replicate.com/openai/gpt-5-pro
- **LifeboardAI Issues**: Check console logs and error messages
