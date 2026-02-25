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

    const input: Record<string, unknown> = {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature,
      top_p,
    };

    if (typeof max_tokens === 'number') {
      // Replicate expects `max_completion_tokens` for GPT-5
      input.max_completion_tokens = max_tokens;
    }

    const prediction = await replicate.predictions.create({
      model: 'openai/gpt-5',
      input,
    });

    let finalPrediction = prediction;
    const pollStart = Date.now();
    const pollTimeoutMs = 90_000;
    const pollDelayMs = 1_000;

    while (finalPrediction.status === 'starting' || finalPrediction.status === 'processing') {
      if (Date.now() - pollStart > pollTimeoutMs) {
        throw new Error('GPT-5 Pro prediction timed out after 90s');
      }
      await new Promise(resolve => setTimeout(resolve, pollDelayMs));
      finalPrediction = await replicate.predictions.get(finalPrediction.id);
    }

    if (finalPrediction.status !== 'succeeded') {
      throw new Error(`GPT-5 Pro prediction failed with status ${finalPrediction.status}`);
    }

    const fullResponse = extractText(finalPrediction.output);

    if (!fullResponse || fullResponse.trim().length === 0) {
      throw new Error('GPT-5 Pro returned an empty response');
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

    const input: Record<string, unknown> = {
      messages,
      temperature,
      top_p,
    };

    if (typeof max_tokens === 'number') {
      input.max_completion_tokens = max_tokens;
    }

    const stream = await replicate.stream(
      "openai/gpt-5" as any,
      { input }
    );

    for await (const event of stream) {
      yield event;
    }
  } catch (error) {
    console.error('Error streaming GPT-5 Pro:', error);
    throw error;
  }
}

function extractText(node: unknown): string {
  if (node == null) return '';

  if (typeof node === 'string') {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;

    if (typeof obj.text === 'string') {
      return obj.text;
    }

    if (typeof obj.output_text === 'string') {
      return obj.output_text;
    }

    if (typeof obj.delta === 'string') {
      return obj.delta;
    }

    if (obj.delta) {
      return extractText(obj.delta);
    }

    if (obj.content) {
      return extractText(obj.content);
    }

    if (obj.output) {
      return extractText(obj.output);
    }

    if (obj.message) {
      return extractText(obj.message);
    }

    if (obj.choices) {
      return extractText(obj.choices);
    }

    if (obj.data) {
      return extractText(obj.data);
    }

    return Object.entries(obj)
      .filter(([key]) => !['id', 'role', 'type', 'finish_reason', 'index', 'created', 'model'].includes(key))
      .map(([, value]) => extractText(value))
      .join('');
  }

  return '';
}
