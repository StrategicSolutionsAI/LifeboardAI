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

// ---------------------------------------------------------------------------
// Speech-to-Text (Whisper on Replicate)
// ---------------------------------------------------------------------------

export interface WhisperOptions {
  /** Raw audio buffer (webm, ogg, mp4, wav, etc.) */
  audio: Buffer
  /** MIME type of the audio (e.g. 'audio/webm', 'audio/mp4'). Defaults to 'audio/webm'. */
  mimeType?: string
  /** Language code (e.g. 'en', 'es'). Omit for auto-detection. */
  language?: string
  /** Translate to English */
  translate?: boolean
}

/**
 * Transcribe audio using OpenAI Whisper running on Replicate.
 * @returns The transcription text
 */
/** Detect audio MIME type from buffer magic bytes */
function detectAudioMime(buf: Buffer): string | undefined {
  if (buf.length < 12) return undefined
  // WebM: starts with 0x1A45DFA3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm'
  // OGG: starts with 'OggS'
  if (buf.slice(0, 4).toString() === 'OggS') return 'audio/ogg'
  // MP4/M4A: has 'ftyp' at offset 4
  if (buf.slice(4, 8).toString() === 'ftyp') return 'audio/mp4'
  // WAV: starts with 'RIFF'
  if (buf.slice(0, 4).toString() === 'RIFF') return 'audio/wav'
  // MP3: starts with 0xFF 0xFB or ID3
  if ((buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) || buf.slice(0, 3).toString() === 'ID3') return 'audio/mpeg'
  // FLAC: starts with 'fLaC'
  if (buf.slice(0, 4).toString() === 'fLaC') return 'audio/flac'
  return undefined
}

// Whisper requires the version-pinned identifier (doesn't support the /models/ predictions endpoint)
const WHISPER_VERSION = '8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e'

export async function runWhisper(options: WhisperOptions): Promise<string> {
  const { audio, mimeType, language, translate = false } = options
  const replicate = getReplicate()

  // Convert Buffer to a data URI so the Replicate SDK can handle it
  // Use the provided MIME type, or detect from buffer magic bytes, or default to webm
  const resolvedMime = mimeType || detectAudioMime(audio) || 'audio/webm'
  const b64 = audio.toString('base64')
  const dataUri = `data:${resolvedMime};base64,${b64}`

  const input: Record<string, unknown> = {
    audio: dataUri,
  }
  if (language) input.language = language
  if (translate) input.translate = true

  const output = await replicate.run(`openai/whisper:${WHISPER_VERSION}`, { input }) as any

  // Output: { detected_language, transcription, segments, ... }
  if (output && typeof output.transcription === 'string') {
    return output.transcription.trim()
  }
  // Fallback: try extractText for unexpected output shapes
  const text = extractText(output)
  if (!text || text.trim().length === 0) {
    throw new Error('Whisper returned an empty transcription')
  }
  return text.trim()
}

// ---------------------------------------------------------------------------
// Text-to-Speech (MiniMax Speech-02-Turbo on Replicate)
// ---------------------------------------------------------------------------

export interface TTSOptions {
  /** Text to synthesize (max 10,000 chars) */
  text: string
  /** Voice name — accepts OpenAI names (mapped) or MiniMax voice_id directly */
  voice?: string
  /** Speed multiplier 0.5–2.0 (default 1.0) */
  speed?: number
  /** Emotion: happy, sad, angry, fearful, disgusted, surprised, or neutral */
  emotion?: string
}

/** Map OpenAI voice names → MiniMax voice IDs */
const VOICE_MAP: Record<string, string> = {
  alloy: 'English_CalmWoman',
  ash: 'English_Trustworth_Man',
  ballad: 'English_Gentle_Woman',
  coral: 'English_Friendly_Woman',
  echo: 'Deep_Voice_Man',
  sage: 'English_Wise_Woman',
  shimmer: 'English_Cheerful_Girl',
  verse: 'English_Storyteller_Man',
  marin: 'English_Sweet_Girl',
  cedar: 'English_Confident_Man',
}

/**
 * Generate speech audio using MiniMax Speech-02-Turbo on Replicate.
 * @returns URL to the generated audio file
 */
export async function runTTS(options: TTSOptions): Promise<string> {
  const { text, voice = 'alloy', speed = 1.0, emotion } = options
  const replicate = getReplicate()

  // Resolve voice: check our map first, otherwise pass through as-is
  const voiceId = VOICE_MAP[voice] || voice

  const input: Record<string, unknown> = {
    text,
    voice_id: voiceId,
    speed: Math.max(0.5, Math.min(2.0, speed)),
    audio_format: 'mp3',
    sample_rate: '32000',
    bitrate: '128000',
    channel: '1',
  }
  if (emotion) input.emotion = emotion

  const output = await replicate.run('minimax/speech-02-turbo', { input }) as any

  // Output is typically a FileOutput (URL string) or { audio: url }
  let audioUrl: string | undefined
  if (typeof output === 'string') {
    audioUrl = output
  } else if (output && typeof output === 'object') {
    // Could be a FileOutput (has toString/href) or an object with audio field
    if (typeof output.audio === 'string') {
      audioUrl = output.audio
    } else if (output.url) {
      audioUrl = String(output.url)
    } else {
      audioUrl = String(output)
    }
  }

  if (!audioUrl || audioUrl === '[object Object]') {
    throw new Error('MiniMax TTS returned unexpected output format')
  }

  return audioUrl
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
