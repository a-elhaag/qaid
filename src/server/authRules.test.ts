import { describe, expect, it } from 'vitest';
import { safeNext } from './authRules';

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
