import Replicate from 'replicate';
import { File as NodeFile } from 'buffer';

// Use Node.js File (available in Node 20+ from buffer module)
const FileImpl = typeof globalThis.File !== 'undefined' ? globalThis.File : NodeFile;

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

  // Upload audio as a File object — more reliable than data URIs for webm/opus
  const resolvedMime = mimeType || detectAudioMime(audio) || 'audio/webm'
  const ext = resolvedMime.includes('webm') ? 'webm' : resolvedMime.includes('ogg') ? 'ogg'
    : resolvedMime.includes('mp4') ? 'mp4' : resolvedMime.includes('wav') ? 'wav'
    : resolvedMime.includes('mpeg') ? 'mp3' : 'webm'
  const file = new FileImpl([audio], `audio.${ext}`, { type: resolvedMime })

  const input: Record<string, unknown> = {
    audio: file,
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
// Text-to-Speech (Chatterbox Turbo by Resemble AI on Replicate)
// ---------------------------------------------------------------------------

export interface TTSOptions {
  /** Text to synthesize (max 500 chars — longer text is auto-chunked) */
  text: string
  /** Voice name — accepts legacy names (mapped) or Chatterbox voice names directly */
  voice?: string
  /** Speed multiplier — mapped to temperature (lower temp = more consistent/faster feel) */
  speed?: number
}

/**
 * Available Chatterbox Turbo voices:
 * Aaron, Abigail, Anaya, Andy, Archer, Brian, Chloe, Dylan,
 * Emmanuel, Ethan, Evelyn, Gavin, Gordon, Ivan, Laura, Lucy,
 * Madison, Marisol, Meera, Walter
 */
export const CHATTERBOX_VOICES = [
  'Aaron', 'Abigail', 'Anaya', 'Andy', 'Archer', 'Brian', 'Chloe', 'Dylan',
  'Emmanuel', 'Ethan', 'Evelyn', 'Gavin', 'Gordon', 'Ivan', 'Laura', 'Lucy',
  'Madison', 'Marisol', 'Meera', 'Walter',
] as const

/** Map legacy voice names → Chatterbox Turbo voice names */
const VOICE_MAP: Record<string, string> = {
  // Legacy OpenAI-style names
  alloy: 'Chloe',
  ash: 'Ethan',
  ballad: 'Evelyn',
  coral: 'Madison',
  echo: 'Gordon',
  sage: 'Laura',
  shimmer: 'Anaya',
  verse: 'Brian',
  marin: 'Abigail',
  cedar: 'Aaron',
}

/**
 * Generate speech audio using Chatterbox Turbo (Resemble AI) on Replicate.
 * Produces natural, human-like speech with 20 preset voices.
 * @returns URL to the generated WAV audio file
 */
export async function runTTS(options: TTSOptions): Promise<string> {
  const { text, voice = 'Chloe', speed } = options
  const replicate = getReplicate()

  // Resolve voice: check legacy map first, then check if it's a valid Chatterbox name, else default
  const resolvedVoice = VOICE_MAP[voice]
    || (CHATTERBOX_VOICES.includes(voice as any) ? voice : 'Chloe')

  // Chatterbox has a 500-char limit — for longer text, chunk and concatenate
  const maxLen = 500
  const chunks = text.length <= maxLen
    ? [text]
    : splitTextIntoChunks(text, maxLen)

  // Map speed to temperature: lower speed → lower temperature (more focused/consistent)
  // speed 1.0 → temp 0.8 (default), speed 0.5 → temp 0.4, speed 1.5 → temp 1.2
  const temperature = speed
    ? Math.max(0.05, Math.min(2.0, 0.8 * speed))
    : 0.8

  const audioUrls: string[] = []
  for (const chunk of chunks) {
    const input: Record<string, unknown> = {
      text: chunk,
      voice: resolvedVoice,
      temperature,
    }

    const output = await replicate.run('resemble-ai/chatterbox-turbo', { input }) as any

    // Output is a FileOutput — its toString() returns the download URL
    let audioUrl: string | undefined
    if (typeof output === 'string') {
      audioUrl = output
    } else if (output && typeof output === 'object') {
      // FileOutput.toString() returns the URL; output.url is a function that returns a URL object
      const str = String(output)
      if (str && str !== '[object Object]' && (str.startsWith('http') || str.startsWith('data:'))) {
        audioUrl = str
      } else if (typeof output.url === 'function') {
        const urlObj = output.url()
        audioUrl = urlObj?.href || String(urlObj)
      }
    }

    if (!audioUrl || audioUrl === '[object Object]') {
      throw new Error('Chatterbox Turbo returned unexpected output format')
    }
    audioUrls.push(audioUrl)
  }

  // For single chunks, return the URL directly
  // For multiple chunks, return the first (caller fetches & concatenates audio buffers)
  return audioUrls[0]
}

/** Split text into chunks at sentence boundaries, respecting maxLen */
function splitTextIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    // Find the last sentence-ending punctuation within maxLen
    let splitIdx = -1
    for (let i = maxLen - 1; i >= maxLen / 2; i--) {
      if ('.!?'.includes(remaining[i])) {
        splitIdx = i + 1
        break
      }
    }
    // Fallback: split at last space
    if (splitIdx === -1) {
      for (let i = maxLen - 1; i >= maxLen / 2; i--) {
        if (remaining[i] === ' ') {
          splitIdx = i + 1
          break
        }
      }
    }
    // Last resort: hard split
    if (splitIdx === -1) splitIdx = maxLen

    chunks.push(remaining.slice(0, splitIdx).trim())
    remaining = remaining.slice(splitIdx).trim()
  }

  return chunks
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
