import { clientStatus, isSilent, missingExpected, type ClientStatus } from '@/brain/status';
import type { Entry } from '@/brain/types';
import { db } from './db';

export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
export function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const idx = y * 12 + (mo - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export interface BoardRow {
  id: string;
  name: string;
  nameEn: string;
  token: string;
  status: ClientStatus;
  counts: { review: number; flags: number; missing: string[]; uploads: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapEntry = (r: any): Entry => ({
  id: r.id,
  clientId: r.client_id,
  documentId: r.document_id,
  vendor: r.vendor,
  date: r.entry_date,
  subtotal: Number(r.subtotal),
  vat: Number(r.vat),
  total: Number(r.total),
  category: r.category,
  confirmed: r.confirmed,
});

export async function loadBoard(officeId: string, now = new Date()): Promise<BoardRow[]> {
  const cur = monthKey(now);
  const clients = await db().from('clients').select('id,name,name_en,token').eq('office_id', officeId).order('name');
  const ids = (clients.data ?? []).map((c) => c.id);
  if (!ids.length) return [];
  const [docs, entries, flags, expected] = await Promise.all([
    db().from('documents').select('id,client_id,status,created_at').in('client_id', ids),
    db().from('entries').select('*').in('client_id', ids),
    db().from('flags').select('client_id,open').eq('open', true).in('client_id', ids),
    db().from('expected_docs').select('client_id,vendor').in('client_id', ids),
  ]);
  return (clients.data ?? []).map((c) => {
    const myDocs = (docs.data ?? []).filter((d) => d.client_id === c.id);
    const myEntries = (entries.data ?? []).filter((e) => e.client_id === c.id).map(mapEntry);
    const uploadsIn = (m: string) => myDocs.filter((d) => d.created_at.slice(0, 7) === m).length;
    // prior-month uploads also count entries (seeded history has entries without documents)
    const activityIn = (m: string) => Math.max(uploadsIn(m), myEntries.filter((e) => e.date.slice(0, 7) === m).length);
    const prior = [shiftMonth(cur, -1), shiftMonth(cur, -2)].map(activityIn);
    const uploads = activityIn(cur);
    const monthVendors = myEntries.filter((e) => e.date.slice(0, 7) === cur).map((e) => e.vendor);
    const missing = missingExpected(
      (expected.data ?? []).filter((x) => x.client_id === c.id).map((x) => x.vendor),
      monthVendors,
    );
    const review = myDocs.filter((d) => d.status === 'needs_review').length;
    const openFlags = (flags.data ?? []).filter((f) => f.client_id === c.id).length;
    const silent = isSilent(uploads, prior);
    return {
      id: c.id,
      name: c.name,
      nameEn: c.name_en || c.name,
      token: c.token,
      status: clientStatus({ openFlags, missing: missing.length, silent, needsReview: review }),
      counts: { review, flags: openFlags, missing, uploads },
    };
  });
}

/** Friendly document labels ("rent receipt") for missing vendors; falls back to the vendor name. */
export async function missingLabels(clientId: string, vendors: string[]): Promise<string[]> {
  const { data } = await db().from('expected_docs').select('vendor,label').eq('client_id', clientId);
  return vendors.map((v) => data?.find((l) => l.vendor === v)?.label ?? v);
}
