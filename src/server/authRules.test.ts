import { describe, expect, it } from 'vitest';
import { assertSameOffice, safeNext } from './authRules';

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/board/abc?x=1')).toBe('/board/abc?x=1');
  });
  it('blocks open redirects', () => {
    expect(safeNext('https://evil.com')).toBe('/board');
    expect(safeNext('//evil.com')).toBe('/board');
    expect(safeNext('/\\evil.com')).toBe('/board');
    expect(safeNext('javascript:alert(1)')).toBe('/board');
  });
  it('defaults when missing', () => {
    expect(safeNext(null)).toBe('/board');
    expect(safeNext(undefined)).toBe('/board');
    expect(safeNext('')).toBe('/board');
  });
});

describe('assertSameOffice', () => {
  it('passes for the same office', () => expect(() => assertSameOffice('o1', 'o1')).not.toThrow());
  it('throws for another office, missing row, or missing office', () => {
    expect(() => assertSameOffice('o2', 'o1')).toThrow('forbidden');
    expect(() => assertSameOffice(null, 'o1')).toThrow('forbidden');
    expect(() => assertSameOffice(undefined, 'o1')).toThrow('forbidden');
  });
});
