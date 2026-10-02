import { describe, expect, it } from 'vitest';
import { payroll, priceChanges, profitAndLoss, vatSummary } from './index';
import type { Entry } from '../types';

const e = (o: Partial<Entry>): Entry => ({
  id: Math.random().toString(36).slice(2), clientId: 'c1', documentId: null, vendor: 'v',
  date: '2026-10-05', subtotal: 100, vat: 14, total: 114, category: 'supplies', confirmed: true, ...o,
});

describe('vatSummary', () => {
  it('output minus input, confirmed only', () => {
    const r = vatSummary([
      e({ category: 'sales', subtotal: 1000, vat: 140, total: 1140 }),
      e({ category: 'supplies', vat: 14 }),
      e({ category: 'supplies', vat: 99, confirmed: false }),
    ]);
    expect(r).toEqual({ outputVat: 140, inputVat: 14, payable: 126 });
  });
});

describe('profitAndLoss', () => {
  it('uses net-of-VAT subtotals and ignores unconfirmed', () => {
    const r = profitAndLoss([
      e({ category: 'sales', subtotal: 1000, vat: 140, total: 1140 }),
      e({ category: 'rent', subtotal: 300, vat: 0, total: 300 }),
      e({ category: 'supplies', subtotal: 200, vat: 28, total: 228 }),
      e({ category: 'supplies', subtotal: 5000, confirmed: false }),
    ]);
    expect(r.revenue).toBe(1000);
    expect(r.expensesByCategory).toEqual({ rent: 300, supplies: 200 });
    expect(r.totalExpenses).toBe(500);
    expect(r.net).toBe(500);
    expect(r.margin).toBe(0.5);
  });
  it('margin is null with no revenue (no divide by zero)', () => {
    expect(profitAndLoss([e({ category: 'rent', subtotal: 300 })]).margin).toBeNull();
  });
});

describe('payroll', () => {
  it('clamps wage to insurable bounds and applies rates', () => {
    const r = payroll([
      { name: 'low', wage: 2000 },
      { name: 'mid', wage: 10000 },
      { name: 'high', wage: 30000 },
    ]);
    expect(r.rows.map((x) => x.insurable)).toEqual([2700, 10000, 16700]);
    expect(r.rows[1].employee).toBe(1100);
    expect(r.rows[1].employer).toBe(1875);
    expect(r.totalEmployee).toBe(round(2700 * 0.11 + 1100 + 16700 * 0.11));
  });
});
const round = (n: number) => Math.round(n * 100) / 100;

describe('priceChanges', () => {
  it('reports per-vendor average change, biggest first', () => {
    const prev = [e({ vendor: 'A', total: 100 }), e({ vendor: 'B', total: 200 })];
    const cur = [e({ vendor: 'A', total: 109 }), e({ vendor: 'B', total: 202 })];
    const r = priceChanges(prev, cur);
    expect(r[0]).toMatchObject({ vendor: 'A', pct: 0.09 });
    expect(r[1].vendor).toBe('B');
  });
  it('ignores vendors with no previous history', () => {
    expect(priceChanges([], [e({ vendor: 'new' })])).toEqual([]);
  });
});
