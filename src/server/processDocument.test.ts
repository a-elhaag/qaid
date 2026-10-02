import { describe, expect, it } from 'vitest';
import { processDocument, type Repo } from './processDocument';
import { fuse } from '@/brain/extract/fuse';
import type { Entry, Flag } from '@/brain/types';

const ext = { vendor: 'Gulf Supplies', date: '2026-10-05', subtotal: 109, vat: 15.26, total: 124.26, docType: 'purchase' as const };

function fakeRepo(existing: Entry[] = []) {
  const state = { status: [] as string[], inserted: [] as any[], flags: [] as Flag[], cleared: [] as string[] };
  const repo: Repo = {
    async setStatus(_id, s) { state.status.push(s); },
    async clearDocument(id) { state.cleared.push(id); },
    async loadImage() { return { b64: 'x', mime: 'image/jpeg', clientId: 'c1', imageHash: 'h1' }; },
    async entriesForClient() { return existing; },
    async insertEntry(e) { state.inserted.push(e); return 'new-entry'; },
    async insertFlags(_c, f) { state.flags.push(...f); },
  };
  return { repo, state };
}
const deps = (repo: Repo) => ({
  repo,
  extract: async () => fuse(ext, ext, null),
  categorise: async () => ({ category: 'supplies' as const, confidence: 0.9, question: null }),
});

describe('processDocument', () => {
  it('writes an entry and ends needs_review', async () => {
    const { repo, state } = fakeRepo();
    await processDocument('d1', deps(repo));
    expect(state.status).toEqual(['extracting', 'needs_review']);
    expect(state.inserted[0]).toMatchObject({ vendor: 'Gulf Supplies', total: 124.26, category: 'supplies' });
  });

  it('raises a price-jump flag against history', async () => {
    const hist: Entry[] = [1, 2].map((i) => ({ id: `h${i}`, clientId: 'c1', documentId: null, vendor: 'Gulf Supplies', date: `2026-0${7 + i}-05`, subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: true }));
    const { repo, state } = fakeRepo(hist);
    await processDocument('d1', deps(repo));
    expect(state.flags.map((f) => f.kind)).toContain('price_jump');
  });

  it('raises a duplicate flag for the same image hash', async () => {
    const dup: Entry = { id: 'old', clientId: 'c1', documentId: 'd0', vendor: 'Other', date: '2026-01-01', subtotal: 1, vat: 0, total: 1, category: 'other', confirmed: true, imageHash: 'h1' };
    const { repo, state } = fakeRepo([dup]);
    await processDocument('d1', deps(repo));
    expect(state.flags.map((f) => f.kind)).toContain('duplicate');
  });

  it('first-ever vendor: no flags and no crash', async () => {
    const { repo, state } = fakeRepo([]);
    await processDocument('d1', deps(repo));
    expect(state.flags).toEqual([]);
  });

  it('clears entries of an earlier failed attempt so a retry never duplicates', async () => {
    const { repo, state } = fakeRepo();
    await processDocument('d1', deps(repo));
    expect(state.cleared).toEqual(['d1']);
  });

  it('extraction failure rethrows so the job retries', async () => {
    const { repo } = fakeRepo();
    await expect(processDocument('d1', { ...deps(repo), extract: async () => { throw new Error('both lanes failed'); } })).rejects.toThrow('both lanes failed');
  });
});
