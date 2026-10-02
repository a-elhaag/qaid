import { describe, expect, it } from 'vitest';
import { findDuplicates, findPriceJump, findVatSpike } from './index';
import type { Entry } from '../types';

const e = (o: Partial<Entry>): Entry => ({
  id: 'x', clientId: 'c1', documentId: null, vendor: 'Gulf Supplies', date: '2026-10-05',
  subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: false, ...o,
});

describe('findDuplicates', () => {
  it('flags same vendor+date+total on another entry', () => {
    const f = findDuplicates(e({ id: 'new' }), [e({ id: 'old' })]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: 'duplicate', entryId: 'new' });
  });
  it('flags same image hash even if fields differ', () => {
    const f = findDuplicates(e({ id: 'new', imageHash: 'h', total: 1 }), [e({ id: 'old', imageHash: 'h' })]);
    expect(f).toHaveLength(1);
  });
  it('ignores itself and other clients', () => {
    expect(findDuplicates(e({ id: 'a' }), [e({ id: 'a' }), e({ id: 'b', clientId: 'c2' })])).toEqual([]);
  });
});

describe('findPriceJump', () => {
  const hist = [e({ id: 'h1', date: '2026-08-05', total: 100 }), e({ id: 'h2', date: '2026-09-05', total: 100 })];
  it('flags a 9% rise', () => {
    const f = findPriceJump(e({ id: 'n', total: 109 }), hist);
    expect(f?.kind).toBe('price_jump');
    expect(f?.detail).toContain('9%');
  });
  it('does not flag a 3% rise', () => {
    expect(findPriceJump(e({ id: 'n', total: 103 }), hist)).toBeNull();
  });
  it('no history: no flag, no crash', () => {
    expect(findPriceJump(e({ id: 'n' }), [])).toBeNull();
  });
  it('filters out foreign-client entries that would pollute average', () => {
    // Foreign client with cheap entries (would lower average and hide a price jump)
    const mixedHist = [
      e({ id: 'h1', date: '2026-08-05', total: 100, clientId: 'c1' }),
      e({ id: 'h2', date: '2026-09-05', total: 50, clientId: 'c2' }), // foreign, cheap
    ];
    // 101 is 1% rise vs [100] alone, but 1% vs [100, 50]=75 would not flag
    const f = findPriceJump(e({ id: 'n', clientId: 'c1', total: 109 }), mixedHist);
    expect(f?.kind).toBe('price_jump'); // Must flag; filters out c2's cheap entry
  });
  it('ignores history entry with same id as current entry', () => {
    const mixedHist = [
      e({ id: 'same', date: '2026-08-05', total: 100 }),
      e({ id: 'h2', date: '2026-09-05', total: 100 }),
    ];
    const f = findPriceJump(e({ id: 'same', total: 109 }), mixedHist);
    expect(f?.kind).toBe('price_jump'); // Filters out the entry itself
  });
  it('ignores history for different vendor', () => {
    const mixedHist = [
      e({ id: 'h1', date: '2026-08-05', total: 100, vendor: 'Gulf Supplies' }),
      e({ id: 'h2', date: '2026-09-05', total: 50, vendor: 'Other Vendor' }),
    ];
    const f = findPriceJump(e({ id: 'n', vendor: 'Gulf Supplies', total: 109 }), mixedHist);
    expect(f?.kind).toBe('price_jump'); // 109 is 9% vs [100], flags correctly
  });
  it('ignores later-dated history entries', () => {
    const mixedHist = [
      e({ id: 'h1', date: '2026-08-05', total: 100 }),
      e({ id: 'h2', date: '2026-10-10', total: 200 }), // later than entry
    ];
    const f = findPriceJump(e({ id: 'n', date: '2026-10-05', total: 109 }), mixedHist);
    expect(f?.kind).toBe('price_jump'); // 109 is 9% vs [100], flags correctly
  });
});

describe('findVatSpike', () => {
  it('flags 2x the prior average', () => {
    expect(findVatSpike('n', 200, [100, 100])?.kind).toBe('vat_spike');
  });
  it('no prior months: no flag', () => {
    expect(findVatSpike('n', 200, [])).toBeNull();
    expect(findVatSpike('n', 200, [0, 0])).toBeNull();
  });
  it('normal month: no flag', () => {
    expect(findVatSpike('n', 110, [100, 100])).toBeNull();
  });
});
