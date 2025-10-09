import Replicate from 'replicate';

function getReplicate() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not set in environment variables');
  }
  return new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
}

export interface GPT5Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GPT5Options {
  messages: GPT5Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

/**
 * Run GPT-5 Pro via Replicate
 * @param options - Configuration for the GPT-5 Pro model
 * @returns The model's response text
 */
export async function runGPT5Pro(options: GPT5Options): Promise<string> {
  const {
    messages,
    temperature = 0.7,
    max_tokens = 1024,
    top_p = 0.9,
  } = options;

  try {
    console.log('🔧 Getting Replicate client...');
    const replicate = getReplicate();
    console.log('🔧 Replicate client initialized');
    console.log('🔧 Creating GPT-5 Pro prediction...');
    
    // Create prediction and get stream URL
    const prediction = await replicate.predictions.create({
      model: "openai/gpt-5-pro",
      input: {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_completion_tokens: max_tokens,
        verbosity: "medium",
      },
      stream: true,
    } as any);

    console.log('🔧 Prediction created:', prediction.id);
    
    // Wait for prediction to complete and get output
    let finalPrediction = prediction;
    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
      await new Promise(resolve => setTimeout(resolve, 500));
      finalPrediction = await replicate.predictions.get(prediction.id);
      console.log('🔧 Status:', finalPrediction.status);
    }
    
    if (finalPrediction.status === 'failed') {
      throw new Error(`GPT-5 Pro failed: ${finalPrediction.error}`);
    }
    
    // Get the output - GPT-5 Pro returns array of strings
    const output = finalPrediction.output;
    console.log('🔧 Output type:', typeof output, 'Is array:', Array.isArray(output));
    console.log('🔧 Raw output:', JSON.stringify(output));
    
    let fullResponse = '';
    if (Array.isArray(output)) {
      fullResponse = output.filter(s => s && s.trim()).join('');
    } else if (typeof output === 'string') {
      fullResponse = output;
    } else if (output && typeof output === 'object') {
      fullResponse = JSON.stringify(output);
    }

    console.log('✅ Streaming completed, response length:', fullResponse.length);
    console.log('🔧 Response preview:', fullResponse.substring(0, 100));
    
    if (!fullResponse || fullResponse.trim().length === 0) {
      throw new Error('GPT-5 Pro returned empty response - check Replicate account access');
    }
    
    return fullResponse.trim();
  } catch (error) {
    console.error('❌ Error in runGPT5Pro:', error);
    console.error('Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Stream GPT-5 Pro responses via Replicate
 * @param options - Configuration for the GPT-5 Pro model
 * @returns AsyncIterable for streaming responses
 */
export async function* streamGPT5Pro(options: GPT5Options) {
  const {
    messages,
    temperature = 0.7,
    max_tokens = 1024,
    top_p = 0.9,
  } = options;

  try {
    const replicate = getReplicate();
    const stream = await replicate.stream(
      "openai/gpt-5-pro" as any,
      {
        input: {
          messages,
          temperature,
          max_tokens,
          top_p,
        },
      }
    );

    for await (const event of stream) {
      yield event;
    }
  } catch (error) {
    console.error('Error streaming GPT-5 Pro:', error);
    throw error;
  }
}
