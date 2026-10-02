import OpenAI from 'openai';
import { z } from 'zod';
import type { ChatMsg } from '@/brain/draft/reminder';
import type { Extracted } from '@/brain/types';
import { route, type JobKind } from './models';

let client: OpenAI | null = null;
/** One Foundry host serves every job today; `job` leaves room to split chat onto its own base URL. */
export const openai = (job: JobKind = 'extract') => {
  const r = route(job);
  return (client ??= new OpenAI({ apiKey: r.apiKey, baseURL: r.openaiBaseURL }));
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

const num = { type: ['number', 'null'] };
const RECEIPT_JSON_SCHEMA = {
  name: 'receipt',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['vendor', 'date', 'subtotal', 'vat', 'total', 'docType'],
    properties: {
      vendor: { type: ['string', 'null'] },
      date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
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
  const content = input.imageDataUrl
    ? [{ type: 'text' as const, text: 'Read this receipt.' }, { type: 'image_url' as const, image_url: { url: input.imageDataUrl } }]
    : `Receipt text (Markdown from an OCR parser):\n${input.text}`;
  const r = await openai('extract').chat.completions.create({
    model: route('extract').model,
    reasoning_effort: 'low',
    response_format: { type: 'json_schema', json_schema: RECEIPT_JSON_SCHEMA },
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
  } as never) as OpenAI.Chat.ChatCompletion; // cast: reasoning_effort for GPT-6 is not in the SDK types yet
  return ExtractedSchema.parse(JSON.parse(r.choices[0].message.content ?? '{}'));
}
