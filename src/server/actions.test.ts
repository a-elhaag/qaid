import { expect, it } from 'vitest';
import { canConfirm, cleanPatch } from './entryRules';

it('accepts a complete entry', () => expect(canConfirm({ vendor: 'A', total: 10, date: '2026-10-01' })).toBe(true));
it('rejects empty vendor, zero total, bad date', () => {
  expect(canConfirm({ vendor: '', total: 10, date: '2026-10-01' })).toBe(false);
  expect(canConfirm({ vendor: 'A', total: 0, date: '2026-10-01' })).toBe(false);
  expect(canConfirm({ vendor: 'A', total: 10, date: 'nope' })).toBe(false);
});
it('cleanPatch drops unknown fields and bad values', () => {
  expect(cleanPatch({ confirmed: true, client_id: 'x', category: 'bogus', total: -5, vat: NaN, vendor: ' Shop ' })).toEqual({ vendor: 'Shop' });
  expect(cleanPatch({ category: 'rent', total: 10.456, entry_date: '2026-10-02' })).toEqual({ category: 'rent', total: 10.46, entry_date: '2026-10-02' });
});
