import { CATEGORIES } from '@/brain/config';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function canConfirm(e: { vendor: string; total: number; date: string }) {
  return e.vendor.trim() !== '' && e.total > 0 && DATE.test(e.date) && !Number.isNaN(Date.parse(e.date));
}

/** Keeps only editable fields with valid values. Browser input is never trusted. */
export function cleanPatch(patch: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (typeof patch.vendor === 'string') out.vendor = patch.vendor.trim().slice(0, 120);
  if (typeof patch.entry_date === 'string' && DATE.test(patch.entry_date) && !Number.isNaN(Date.parse(patch.entry_date))) out.entry_date = patch.entry_date;
  for (const k of ['subtotal', 'vat', 'total']) {
    const v = patch[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9) out[k] = Math.round(v * 100) / 100;
  }
  if (typeof patch.category === 'string' && (CATEGORIES as readonly string[]).includes(patch.category)) out.category = patch.category;
  return out;
}
