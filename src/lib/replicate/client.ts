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
    const replicate = getReplicate();
    const output = await replicate.run(
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

    // Replicate returns output as an array of strings for streaming models
    // or a single string for non-streaming
    if (Array.isArray(output)) {
      return output.join('');
    }
    
    return String(output || '');
  } catch (error) {
    console.error('Error running GPT-5 Pro:', error);
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
