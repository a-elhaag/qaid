import { THRESHOLDS } from '../config';
import type { DocType, Extracted } from '../types';
import { appearsIn } from './digits';

type Field = 'vendor' | 'date' | 'subtotal' | 'vat' | 'total';
type Value = string | number;
export type Agreement = 'agree' | 'resolved' | 'disputed' | 'single';
export interface FusedField { value: Value | null; agreement: Agreement; candidates: Value[] }
export interface Fused {
  fields: Record<Field, FusedField>;
  docType: DocType;
  confidence: 'high' | 'medium' | 'low';
  disputed: string[];
  arithmeticOk: boolean;
}

const FIELDS: Field[] = ['vendor', 'date', 'subtotal', 'vat', 'total'];
const NUMERIC = new Set<Field>(['subtotal', 'vat', 'total']);

const norm = (v: Value | null) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : v);
const same = (a: Value | null, b: Value | null) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.005 : norm(a) === norm(b);

/** Unknown (any null) counts as consistent: total-only receipts are valid. */
function consistent(e: Extracted): boolean {
  if (e.subtotal == null || e.vat == null || e.total == null) return true;
  return Math.abs(e.subtotal + e.vat - e.total) <= THRESHOLDS.arithmeticTolerance;
}

export function fuse(a: Extracted | null, b: Extracted | null, parseMarkdown: string | null): Fused {
  if (!a && !b) throw new Error('both lanes failed');
  const both = !!a && !!b;
  const trioA = a ? consistent(a) : true;
  const trioB = b ? consistent(b) : true;
  const fields = {} as Record<Field, FusedField>;

  for (const f of FIELDS) {
    const va = (a?.[f] ?? null) as Value | null;
    const vb = (b?.[f] ?? null) as Value | null;
    if (!both) {
      const v = va ?? vb;
      fields[f] = { value: v, agreement: 'single', candidates: v == null ? [] : [v] };
      continue;
    }
    if (same(va, vb)) {
      fields[f] = { value: va, agreement: 'agree', candidates: va == null ? [] : [va] };
      continue;
    }
    const candidates = [va, vb].filter((v): v is Value => v != null);
    let pick: Value | null | undefined;
    if (NUMERIC.has(f) && trioA !== trioB) pick = trioA ? va : vb; // arithmetic decides
    else if (parseMarkdown) {
      const hits = candidates.filter((c) => appearsIn(parseMarkdown, f, c));
      if (hits.length === 1) pick = hits[0];
    }
    fields[f] =
      pick != null
        ? { value: pick, agreement: 'resolved', candidates }
        : { value: va ?? vb, agreement: 'disputed', candidates };
  }

  const num = (f: Field) => fields[f].value as number | null;
  const arithmeticOk = consistent({
    vendor: null, date: null, subtotal: num('subtotal'), vat: num('vat'), total: num('total'), docType: 'other',
  });
  const disputed = FIELDS.filter((f) => fields[f].agreement === 'disputed');
  const anyResolved = FIELDS.some((f) => fields[f].agreement === 'resolved');
  const confidence: Fused['confidence'] =
    disputed.length || !arithmeticOk ? 'low' : !both || anyResolved ? 'medium' : 'high';

  return { fields, docType: (a?.docType ?? b?.docType) as DocType, confidence, disputed, arithmeticOk };
}
