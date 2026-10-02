import { beforeAll, describe, expect, it, vi } from 'vitest';
import { extractReceipt } from './extractReceipt';
import { parseToMarkdown } from './parse';
import type { Extracted } from '@/brain/types';

const ok: Extracted = { vendor: 'Spinneys', date: '2026-10-05', subtotal: 100, vat: 14, total: 114, docType: 'purchase' };

describe('extractReceipt', () => {
  it('fuses both lanes', async () => {
    const r = await extractReceipt('b64', 'image/jpeg', {
      laneA: async () => ({ fields: ok, markdown: 'Spinneys 114.00' }),
      laneB: async () => ({ fields: ok }),
    });
    expect(r.confidence).toBe('high');
  });

  it('survives one lane failing', async () => {
    const r = await extractReceipt('b64', 'image/jpeg', {
      laneA: async () => { throw new Error('parse down'); },
      laneB: async () => ({ fields: ok }),
    });
    expect(r.fields.total.value).toBe(114);
    expect(r.confidence).toBe('medium');
  });

  it('throws when both lanes fail so the job retries', async () => {
    await expect(
      extractReceipt('b64', 'image/jpeg', {
        laneA: async () => { throw new Error('a'); },
        laneB: async () => { throw new Error('b'); },
      }),
    ).rejects.toThrow('both lanes failed');
  });
});

describe('parseToMarkdown', () => {
  beforeAll(() => { vi.stubEnv('FOUNDRY_RESOURCE', 'qaid'); vi.stubEnv('FOUNDRY_API_KEY', 'k'); });
  it('joins page markdown and sends a data URI', async () => {
    let doc: unknown;
    const fake = { parse: async (req: { document: unknown }) => { doc = req.document; return { pages: [{ type: 'markdown', markdown: { content: 'a' } }, { type: 'markdown', markdown: { content: 'b' } }] }; } };
    expect(await parseToMarkdown('QQ', 'image/png', fake as never)).toBe('a\nb');
    expect(doc).toEqual({ type: 'image_url', imageUrl: 'data:image/png;base64,QQ' });
  });
  it('throws on empty output', async () => {
    const fake = { parse: async () => ({ pages: [{ type: 'markdown', markdown: { content: '  ' } }] }) };
    await expect(parseToMarkdown('QQ', 'image/png', fake as never)).rejects.toThrow('empty');
  });
});
