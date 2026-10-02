import { describe, expect, it } from 'vitest';
import { appearsIn, normalizeDigits } from './digits';
import { fuse } from './fuse';
import type { Extracted } from '../types';

const x = (o: Partial<Extracted> = {}): Extracted => ({
  vendor: 'Spinneys', date: '2026-10-05', subtotal: 100, vat: 14, total: 114, docType: 'purchase', ...o,
});

describe('normalizeDigits', () => {
  it('converts Arabic-Indic digits and decimal separator', () => {
    expect(normalizeDigits('١٢٣٫٥٠')).toBe('123.50');
    expect(normalizeDigits('۱۲۳')).toBe('123');
  });
});

describe('appearsIn', () => {
  it('finds amounts written with Arabic digits', () => {
    expect(appearsIn('الإجمالي ١١٤٫٠٠ ج.م', 'total', 114)).toBe(true);
  });
  it('does not match inside a longer number', () => {
    expect(appearsIn('total 1140.00', 'total', 114)).toBe(false);
  });
  it('finds dates in dd/mm/yyyy', () => {
    expect(appearsIn('Date: 05/10/2026', 'date', '2026-10-05')).toBe(true);
  });
});

describe('fuse', () => {
  it('both agree: high confidence', () => {
    const r = fuse(x(), x(), 'md');
    expect(r.confidence).toBe('high');
    expect(r.fields.total.agreement).toBe('agree');
    expect(r.disputed).toEqual([]);
  });

  it('lanes differ: arithmetic picks the consistent lane', () => {
    const r = fuse(x({ total: 144 }), x({ total: 114 }), null); // lane A total is wrong
    expect(r.fields.total.value).toBe(114);
    expect(r.fields.total.agreement).toBe('resolved');
    expect(r.confidence).toBe('medium');
  });

  it('lanes differ, arithmetic cannot decide: literal in Parse markdown decides', () => {
    const a = x({ vendor: 'Spinney', total: null, subtotal: null, vat: null });
    const b = x({ vendor: 'Spinneys', total: null, subtotal: null, vat: null });
    const r = fuse(a, b, 'Welcome to Spinneys store');
    expect(r.fields.vendor.value).toBe('Spinneys');
    expect(r.fields.vendor.agreement).toBe('resolved');
  });

  it('truly disputed: keeps both candidates, defaults to lane A, low confidence', () => {
    const a = x({ vendor: 'Alpha', subtotal: null, vat: null, total: null });
    const b = x({ vendor: 'Beta', subtotal: null, vat: null, total: null });
    const r = fuse(a, b, 'no names here');
    expect(r.fields.vendor.agreement).toBe('disputed');
    expect(r.fields.vendor.candidates).toEqual(['Alpha', 'Beta']);
    expect(r.fields.vendor.value).toBe('Alpha');
    expect(r.disputed).toContain('vendor');
    expect(r.confidence).toBe('low');
  });

  it('one lane failed: uses the other, medium confidence, never throws', () => {
    const r = fuse(null, x(), null);
    expect(r.fields.total.value).toBe(114);
    expect(r.fields.total.agreement).toBe('single');
    expect(r.confidence).toBe('medium');
  });

  it('both lanes failed throws', () => {
    expect(() => fuse(null, null, null)).toThrow('both lanes failed');
  });

  it('total-only receipt (no subtotal or VAT) is not an arithmetic failure', () => {
    const t = x({ subtotal: null, vat: null, total: 50 });
    const r = fuse(t, t, null);
    expect(r.arithmeticOk).toBe(true);
    expect(r.confidence).toBe('high');
  });

  it('agreed but arithmetic wrong: low confidence', () => {
    const bad = x({ subtotal: 100, vat: 14, total: 200 });
    const r = fuse(bad, bad, null);
    expect(r.arithmeticOk).toBe(false);
    expect(r.confidence).toBe('low');
  });
});
