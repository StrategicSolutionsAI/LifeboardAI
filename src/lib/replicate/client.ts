import Replicate from 'replicate';

function getReplicate() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not set in environment variables');
  }
  return new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
}

export interface GeminiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GeminiOptions {
  messages: GeminiMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  thinking_level?: 'low' | 'medium' | 'high';
}

/**
 * Convert a messages array into Gemini's prompt + system_instruction format.
 * System messages become system_instruction, user/assistant turns become
 * a structured prompt string.
 */
function convertMessagesToGeminiInput(messages: GeminiMessage[]): {
  system_instruction: string;
  prompt: string;
} {
  const systemParts: string[] = [];
  const conversationParts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else if (msg.role === 'user') {
      conversationParts.push(`User: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      conversationParts.push(`Assistant: ${msg.content}`);
    }
  }

  return {
    system_instruction: systemParts.join('\n\n'),
    prompt: conversationParts.join('\n\n'),
  };
}

/**
 * Run Gemini 3.1 Pro via Replicate
 * @param options - Configuration for the Gemini 3.1 Pro model
 * @returns The model's response text
 */
export async function runGemini(options: GeminiOptions): Promise<string> {
  const {
    messages,
    temperature = 0.7,
    max_tokens = 2048,
    top_p = 0.95,
    thinking_level = 'medium',
  } = options;

  try {
    const replicate = getReplicate();
    const { system_instruction, prompt } = convertMessagesToGeminiInput(messages);

    const input: Record<string, unknown> = {
      prompt,
      temperature,
      top_p,
      thinking_level,
    };

    if (system_instruction) {
      input.system_instruction = system_instruction;
    }

    if (typeof max_tokens === 'number') {
      input.max_output_tokens = max_tokens;
    }

    const prediction = await replicate.predictions.create({
      model: 'google/gemini-3.1-pro',
      input,
    });

    let finalPrediction = prediction;
    const pollStart = Date.now();
    const pollTimeoutMs = 120_000;
    const pollDelayMs = 1_000;

    while (finalPrediction.status === 'starting' || finalPrediction.status === 'processing') {
      if (Date.now() - pollStart > pollTimeoutMs) {
        throw new Error('Gemini 3.1 Pro prediction timed out after 120s');
      }
      await new Promise(resolve => setTimeout(resolve, pollDelayMs));
      finalPrediction = await replicate.predictions.get(finalPrediction.id);
    }

    if (finalPrediction.status !== 'succeeded') {
      throw new Error(`Gemini 3.1 Pro prediction failed with status ${finalPrediction.status}`);
    }

    const fullResponse = extractText(finalPrediction.output);

    if (!fullResponse || fullResponse.trim().length === 0) {
      throw new Error('Gemini 3.1 Pro returned an empty response');
    }

    return fullResponse.trim();
  } catch (error) {
    console.error('❌ Error in runGemini:', error);
    console.error('Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Stream Gemini 3.1 Pro responses via Replicate
 * @param options - Configuration for the Gemini 3.1 Pro model
 * @returns AsyncIterable for streaming responses
 */
export async function* streamGemini(options: GeminiOptions) {
  const {
    messages,
    temperature = 0.7,
    max_tokens = 2048,
    top_p = 0.95,
    thinking_level = 'medium',
  } = options;

  try {
    const replicate = getReplicate();
    const { system_instruction, prompt } = convertMessagesToGeminiInput(messages);

    const input: Record<string, unknown> = {
      prompt,
      temperature,
      top_p,
      thinking_level,
    };

    if (system_instruction) {
      input.system_instruction = system_instruction;
    }

    if (typeof max_tokens === 'number') {
      input.max_output_tokens = max_tokens;
    }

    const stream = await replicate.stream(
      "google/gemini-3.1-pro" as any,
      { input }
    );

    for await (const event of stream) {
      yield event;
    }
  } catch (error) {
    console.error('Error streaming Gemini 3.1 Pro:', error);
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
