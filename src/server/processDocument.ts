import { findDuplicates, findPriceJump, findVatSpike } from '@/brain/checks';
import type { Fused } from '@/brain/extract/fuse';
import type { Category } from '@/brain/config';
import type { Entry, Flag } from '@/brain/types';
import { categorise as defaultCategorise } from './categorise';
import { db } from './db';
import { extractReceipt } from './extractReceipt';
import type { Handlers, Job } from './jobs';

export interface Repo {
  setStatus(id: string, status: string, error?: string): Promise<void>;
  loadImage(docId: string): Promise<{ b64: string; mime: string; clientId: string; imageHash: string | null }>;
  entriesForClient(clientId: string): Promise<Entry[]>;
  insertEntry(e: {
    clientId: string; documentId: string; vendor: string; date: string; subtotal: number; vat: number; total: number;
    category: Category; categoryConfidence: number; question: string | null; agreement: Record<string, string>; confidence: string;
  }): Promise<string>;
  insertFlags(clientId: string, flags: Flag[]): Promise<void>;
  /** Removes entries (and their flags) of an earlier attempt, so a retry never duplicates. */
  clearDocument(docId: string): Promise<void>;
}
interface Deps {
  repo: Repo;
  extract: (b64: string, mime: string) => Promise<Fused>;
  categorise: typeof defaultCategorise;
}

const must = ({ error }: { error: unknown }) => {
  if (error) throw error;
};

export const supabaseRepo: Repo = {
  async setStatus(id, status, error) {
    must(await db().from('documents').update({ status, error: error ?? null }).eq('id', id));
  },
  async clearDocument(docId) {
    must(await db().from('entries').delete().eq('document_id', docId));
  },
  async loadImage(docId) {
    const { data: doc, error } = await db().from('documents').select('client_id,image_path,image_hash').eq('id', docId).single();
    if (error || !doc?.image_path) throw new Error(`document ${docId} not found`);
    const file = await db().storage.from('receipts').download(doc.image_path);
    if (file.error) throw file.error;
    return { b64: Buffer.from(await file.data.arrayBuffer()).toString('base64'), mime: file.data.type || 'image/jpeg', clientId: doc.client_id, imageHash: doc.image_hash };
  },
  async entriesForClient(clientId) {
    const { data, error } = await db().from('entries').select('*, documents(image_hash)').eq('client_id', clientId);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id, clientId: r.client_id, documentId: r.document_id, vendor: r.vendor, date: r.entry_date,
      subtotal: Number(r.subtotal), vat: Number(r.vat), total: Number(r.total), category: r.category, confirmed: r.confirmed,
      imageHash: r.documents?.image_hash ?? null,
    }));
  },
  async insertEntry(e) {
    const { data, error } = await db().from('entries').insert({
      client_id: e.clientId, document_id: e.documentId, vendor: e.vendor, entry_date: e.date, subtotal: e.subtotal, vat: e.vat, total: e.total,
      category: e.category, category_confidence: e.categoryConfidence, question: e.question, agreement: e.agreement, confidence: e.confidence,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  },
  async insertFlags(clientId, flags) {
    if (!flags.length) return;
    must(await db().from('flags').insert(flags.map((f) => ({ client_id: clientId, entry_id: f.entryId, kind: f.kind, detail: f.detail }))));
  },
};

const month = (d: string) => d.slice(0, 7);

export async function processDocument(documentId: string, deps: Deps = { repo: supabaseRepo, extract: extractReceipt, categorise: defaultCategorise }) {
  const { repo } = deps;
  await repo.setStatus(documentId, 'extracting');
  await repo.clearDocument(documentId);
  const img = await repo.loadImage(documentId);
  const fused = await deps.extract(img.b64, img.mime); // throws if both lanes fail: job retries

  const f = fused.fields;
  const vendor = String(f.vendor.value ?? '');
  const date = String(f.date.value ?? new Date().toISOString().slice(0, 10));
  const subtotal = Number(f.subtotal.value ?? f.total.value ?? 0);
  const vat = Number(f.vat.value ?? 0);
  const total = Number(f.total.value ?? 0);
  const cat = await deps.categorise({ vendor, docType: fused.docType, total });

  const entryId = await repo.insertEntry({
    clientId: img.clientId, documentId, vendor, date, subtotal, vat, total, category: cat.category, categoryConfidence: cat.confidence,
    question: cat.question, agreement: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.agreement])), confidence: fused.confidence,
  });

  const entry: Entry = { id: entryId, clientId: img.clientId, documentId, vendor, date, subtotal, vat, total, category: cat.category, confirmed: false, imageHash: img.imageHash };
  const all = await repo.entriesForClient(img.clientId);
  const others = all.filter((e) => e.id !== entryId);
  const history = others.filter((e) => e.vendor.trim().toLowerCase() === vendor.trim().toLowerCase() && e.date < date);
  const priorVats = [...new Set(others.map((e) => month(e.date)).filter((m) => m < month(date)))].map((m) =>
    others.filter((e) => month(e.date) === m).reduce((s, e) => s + e.vat, 0),
  );
  const thisMonthVat = [...others, entry].filter((e) => month(e.date) === month(date)).reduce((s, e) => s + e.vat, 0);

  const flags = [
    ...findDuplicates(entry, others),
    ...[findPriceJump(entry, history), findVatSpike(entryId, thisMonthVat, priorVats)].filter((x): x is Flag => !!x),
  ];
  await repo.insertFlags(img.clientId, flags);
  await repo.setStatus(documentId, 'needs_review');
}

export const handlers: Handlers = {
  process_document: async (p) => processDocument(String(p.documentId)),
};
export const onDead = async (job: Job, error: string) => {
  if (job.type === 'process_document') await supabaseRepo.setStatus(String(job.payload.documentId), 'failed', error);
};
