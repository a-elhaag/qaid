import { describe, expect, it } from 'vitest';
import { clientStatus, isSilent, missingExpected } from './status';

describe('clientStatus priority', () => {
  const base = { openFlags: 0, missing: 0, silent: false, needsReview: 0 };
  it('ready when nothing pending', () => expect(clientStatus(base)).toBe('ready'));
  it('review', () => expect(clientStatus({ ...base, needsReview: 2 })).toBe('review'));
  it('silent beats review', () => expect(clientStatus({ ...base, silent: true, needsReview: 2 })).toBe('silent'));
  it('missing beats silent', () => expect(clientStatus({ ...base, missing: 1, silent: true })).toBe('missing'));
  it('strange beats everything', () =>
    expect(clientStatus({ openFlags: 1, missing: 1, silent: true, needsReview: 1 })).toBe('strange'));
});

describe('missingExpected', () => {
  it('lists expected vendors not seen this month, case-insensitive', () => {
    expect(missingExpected(['Landlord', 'Gulf Supplies'], ['gulf supplies'])).toEqual(['Landlord']);
  });
});

describe('isSilent', () => {
  it('silent only if zero uploads now and uploads in prior months', () => {
    expect(isSilent(0, [4, 5])).toBe(true);
    expect(isSilent(1, [4, 5])).toBe(false);
  });
  it('a brand-new client with no history is not silent', () => {
    expect(isSilent(0, [])).toBe(false);
    expect(isSilent(0, [0, 0])).toBe(false);
  });
});
