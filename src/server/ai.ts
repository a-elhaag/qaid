import OpenAI from 'openai';
import { z } from 'zod';
import type { ChatMsg } from '@/brain/draft/reminder';
import type { Extracted } from '@/brain/types';
import { route, type JobKind } from './models';

let client: OpenAI | null = null;
/** One Groq host serves every job; `job` leaves room to split chat onto its own base URL. */
export const openai = (job: JobKind = 'extract') => {
  const r = route(job);
  return (client ??= new OpenAI({ apiKey: r.apiKey, baseURL: r.baseURL, maxRetries: 6 }));
};

/** Plain text completion, no tools (used by the reminder draft). */
export async function chatText(messages: ChatMsg[]): Promise<string> {
  const r = await openai('draft').chat.completions.create({ model: route('draft').model, messages });
  return r.choices[0].message.content ?? '';
}

const ExtractedSchema = z.object({
  vendor: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  subtotal: z.number().nullable(),
  vat: z.number().nullable(),
  total: z.number().nullable(),
  docType: z.enum(['purchase', 'sale', 'payment_screenshot', 'other']),
});

const num = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const RECEIPT_JSON_SCHEMA = {
  name: 'receipt',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['vendor', 'date', 'subtotal', 'vat', 'total', 'docType'],
    properties: {
      vendor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      date: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'YYYY-MM-DD' },
      subtotal: num,
      vat: num,
      total: num,
      docType: { type: 'string', enum: ['purchase', 'sale', 'payment_screenshot', 'other'] },
    },
  },
} as const;

const SYSTEM = `You read Egyptian receipts, supplier invoices and payment screenshots (Arabic or English, printed).
Return the fields as JSON. Rules: amounts are plain numbers in EGP (convert Arabic-Indic digits to ASCII digits).
Dates as YYYY-MM-DD. Use null for anything not printed. NEVER compute or infer a missing amount. NEVER invent a vendor.
docType: purchase = receipt for something the shop bought; sale = receipt the shop issued to a customer; payment_screenshot; other.`;

export async function structureReceipt(input: { text?: string; imageDataUrl?: string }): Promise<Extracted> {
  const image = input.imageDataUrl;
  const content = image
    ? [{ type: 'text' as const, text: 'Read this receipt.' }, { type: 'image_url' as const, image_url: { url: image } }]
    : `Receipt text (Markdown from an OCR pass):\n${input.text}`;
  const job = image ? 'vision' : 'extract';
  const r = await openai(job).chat.completions.create({
    model: route(job).model,
    // gpt-oss: constrained decoding + low reasoning. Qwen vision: best-effort schema, reasoning off.
    reasoning_effort: image ? 'none' : 'low',
    response_format: { type: 'json_schema', json_schema: { ...RECEIPT_JSON_SCHEMA, strict: !image } },
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
  } as never) as OpenAI.Chat.ChatCompletion; // cast: reasoning_effort is not in the SDK types
  return ExtractedSchema.parse(JSON.parse(r.choices[0].message.content ?? '{}'));
}
