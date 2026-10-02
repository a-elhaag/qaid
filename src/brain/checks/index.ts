import { THRESHOLDS } from '../config';
import type { Entry, Flag } from '../types';

const key = (s: string) => s.trim().toLowerCase();

export function findDuplicates(entry: Entry, others: Entry[]): Flag[] {
  const dup = others.filter(
    (o) =>
      o.id !== entry.id &&
      o.clientId === entry.clientId &&
      ((entry.imageHash && o.imageHash === entry.imageHash) ||
        (key(o.vendor) === key(entry.vendor) && o.date === entry.date && Math.abs(o.total - entry.total) < 0.005)),
  );
  return dup.length ? [{ kind: 'duplicate', entryId: entry.id, detail: `Same as ${dup[0].vendor} ${dup[0].date} ${dup[0].total}` }] : [];
}

export function findPriceJump(entry: Entry, history: Entry[]): Flag | null {
  const filtered = history.filter(
    (h) =>
      h.clientId === entry.clientId &&
      h.id !== entry.id &&
      key(h.vendor) === key(entry.vendor) &&
      h.date < entry.date
  );
  if (!filtered.length) return null;
  const avg = filtered.reduce((s, h) => s + h.total, 0) / filtered.length;
  if (avg <= 0) return null;
  const pct = (entry.total - avg) / avg;
  if (pct < THRESHOLDS.priceJump) return null;
  return { kind: 'price_jump', entryId: entry.id, detail: `${entry.vendor} up ${Math.round(pct * 100)}% vs prior average ${avg.toFixed(2)}` };
}

export function findVatSpike(entryId: string, thisMonthVat: number, priorMonthVats: number[]): Flag | null {
  if (!priorMonthVats.length) return null;
  const avg = priorMonthVats.reduce((a, b) => a + b, 0) / priorMonthVats.length;
  if (avg <= 0 || thisMonthVat < avg * THRESHOLDS.vatSpike) return null;
  return { kind: 'vat_spike', entryId, detail: `VAT ${thisMonthVat.toFixed(2)} vs prior average ${avg.toFixed(2)}` };
}
