import type OpenAI from 'openai';
import { openai } from './ai';
import { route } from './models';

type Vision = Pick<OpenAI.Chat.Completions, 'create'>;

const OCR = 'Transcribe this receipt exactly as printed into Markdown. Keep tables as Markdown tables, keep Arabic as Arabic, copy every digit as printed. Output only the transcription.';

/** Markdown of one image, via a Groq vision model (replaces Cohere Parse, which Groq does not offer). */
export async function parseToMarkdown(imageBase64: string, mime: string, chat: Vision = openai('vision').chat.completions): Promise<string> {
  const r = (await chat.create({
    model: route('vision').model,
    reasoning_effort: 'none',
    temperature: 0,
    messages: [{ role: 'user', content: [{ type: 'text', text: OCR }, { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } }] }],
  } as never)) as OpenAI.Chat.ChatCompletion; // cast: reasoning_effort is not in the SDK types
  const md = r.choices[0].message.content ?? '';
  if (!md.trim()) throw new Error('parse returned empty markdown');
  return md;
}
