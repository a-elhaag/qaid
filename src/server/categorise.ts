import type OpenAI from 'openai';
import { z } from 'zod';
import { CATEGORIES, type Category } from '@/brain/config';
import type { DocType } from '@/brain/types';
import { openai } from './ai';
import { route } from './models';

const Out = z.object({ category: z.enum(CATEGORIES), confidence: z.number().min(0).max(1), question: z.string().nullable() });

export async function categorise(i: { vendor: string; docType: DocType; total: number }) {
  if (i.docType === 'sale') return { category: 'sales' as Category, confidence: 1, question: null };
  const r = await openai('categorise').chat.completions.create({
    model: route('categorise').model,
    reasoning_effort: 'low',
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cat', strict: true,
        schema: {
          type: 'object', additionalProperties: false, required: ['category', 'confidence', 'question'],
          properties: {
            category: { type: 'string', enum: [...CATEGORIES] },
            confidence: { type: 'number' },
            question: { type: ['string', 'null'], description: 'One short Arabic question for the accountant if confidence is below 0.7, else null' },
          },
        },
      },
    },
    messages: [
      { role: 'system', content: 'Classify an expense of a small Egyptian business into exactly one category. If unsure, lower confidence and ask one short Arabic question.' },
      { role: 'user', content: `Vendor: ${i.vendor}\nDocument type: ${i.docType}\nTotal EGP: ${i.total}` },
    ],
  } as never) as OpenAI.Chat.ChatCompletion; // cast: reasoning_effort is not in the SDK types yet
  return Out.parse(JSON.parse(r.choices[0].message.content ?? '{}'));
}
