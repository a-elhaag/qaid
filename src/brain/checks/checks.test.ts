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
  it('filters out foreign-client entries: unfiltered avg 200 hides jump, filtered avg 100 flags it', () => {
    // 109 vs [100] = 9% (flags); 109 vs [100, 300 (c2)] = avg 200 = -45% (no flag)
    const mixedHist = [
      e({ id: 'h1', date: '2026-08-05', total: 100, clientId: 'c1' }),
      e({ id: 'h2', date: '2026-09-05', total: 300, clientId: 'c2' }), // foreign client pollutes avg
    ];
    const f = findPriceJump(e({ id: 'n', clientId: 'c1', total: 109 }), mixedHist);
    expect(f?.kind).toBe('price_jump'); // filters out c2, avg=100, 109 is 9% rise
  });
  it('filters out same-id entries: unfiltered avg 200 hides jump, filtered avg 100 flags it', () => {
    // 109 vs [100] = 9% (flags); 109 vs [300 with id='n', 100 with id='h2'] = avg 200 = -45% (no flag)
    const hist = [
      e({ id: 'n', date: '2026-08-05', total: 300 }), // same id, pollutes avg
      e({ id: 'h2', date: '2026-09-05', total: 100 }), // valid history entry
    ];
    const f = findPriceJump(e({ id: 'n', date: '2026-10-05', total: 109 }), hist);
    expect(f?.kind).toBe('price_jump'); // filters out id='n' (300), avg=100 from h2, 109 is 9% rise
  });
  it('filters out different-vendor entries: unfiltered avg 200 hides jump, filtered avg 100 flags it', () => {
    // 109 vs [100 Gulf Supplies] = 9% (flags); 109 vs [100, 300 Other Vendor] = avg 200 = -45% (no flag)
    const mixedHist = [
      e({ id: 'h1', date: '2026-08-05', total: 100, vendor: 'Gulf Supplies' }),
      e({ id: 'h2', date: '2026-09-05', total: 300, vendor: 'Other Vendor' }),
    ];
    const f = findPriceJump(e({ id: 'n', vendor: 'Gulf Supplies', total: 109 }), mixedHist);
    expect(f?.kind).toBe('price_jump'); // filters out Other Vendor, avg=100, 109 is 9% rise
  });
  it('filters out later-dated history entries: unfiltered avg 200 hides jump, filtered avg 100 flags it', () => {
    // 109 vs [100] = 9% (flags); 109 vs [100, 300 later-dated] = avg 200 = -45% (no flag)
    const mixedHist = [
      e({ id: 'h1', date: '2026-08-05', total: 100 }),
      e({ id: 'h2', date: '2026-10-10', total: 300 }), // later than entry date 2026-10-05
    ];
    const f = findPriceJump(e({ id: 'n', date: '2026-10-05', total: 109 }), mixedHist);
    expect(f?.kind).toBe('price_jump'); // filters out later-dated, avg=100, 109 is 9% rise
  });
  it('all entries filtered out: no division by zero, returns null', () => {
    // History only has foreign-client, different-vendor, and later-dated entries
    const allFilteredHist = [
      e({ id: 'h1', date: '2026-08-05', total: 100, clientId: 'c2' }), // foreign
      e({ id: 'h2', date: '2026-09-05', total: 100, vendor: 'Other Vendor' }), // different vendor
      e({ id: 'h3', date: '2026-10-10', total: 100 }), // later-dated
    ];
    const f = findPriceJump(e({ id: 'n', clientId: 'c1', vendor: 'Gulf Supplies', date: '2026-10-05', total: 109 }), allFilteredHist);
    expect(f).toBeNull(); // all filtered, no crash
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
