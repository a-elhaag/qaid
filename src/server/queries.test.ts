import { expect, it } from 'vitest';
import { monthKey, shiftMonth } from './queries';

it('monthKey', () => expect(monthKey(new Date('2026-10-02T10:00:00Z'))).toBe('2026-10'));
it('shiftMonth wraps years', () => {
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-11', 2)).toBe('2027-01');
});
