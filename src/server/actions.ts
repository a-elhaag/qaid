'use server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { buildReminderMessages } from '@/brain/draft/reminder';
import { chatText } from './ai';
import { requireOffice } from './auth';
import { db } from './db';
import { canConfirm, cleanPatch } from './entryRules';
import { drainWithRetries } from './jobs';
import { enqueue, supabaseJobStore } from './jobStore';
import { handlers, onDead } from './processDocument';
import { loadBoard, monthKey } from './queries';

/** Entry ids that belong to the caller's office. Browser-sent ids are never trusted. */
async function ownedEntryIds(officeId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await db().from('entries').select('id, clients!inner(office_id)').in('id', ids).eq('clients.office_id', officeId);
  return (data ?? []).map((r) => r.id as string);
}

export async function updateEntry(id: string, patch: Record<string, string | number>) {
  const { officeId } = await requireOffice();
  if (!(await ownedEntryIds(officeId, [id])).length) return;
  const clean = cleanPatch(patch);
  if (!Object.keys(clean).length) return;
  await db().from('entries').update(clean).eq('id', id);
  revalidatePath('/board', 'layout');
}

export async function confirmEntries(rawIds: string[]) {
  const { officeId } = await requireOffice();
  const ids = await ownedEntryIds(officeId, rawIds);
  if (!ids.length) return { confirmed: 0, skipped: [] as string[] };
  const { data } = await db().from('entries').select('id,vendor,total,entry_date,document_id').in('id', ids);
  const ok = (data ?? []).filter((e) => canConfirm({ vendor: e.vendor, total: Number(e.total), date: e.entry_date }));
  const skipped = ids.filter((i) => !ok.some((e) => e.id === i));
  if (ok.length) {
    await db().from('entries').update({ confirmed: true }).in('id', ok.map((e) => e.id));
    const docIds = ok.map((e) => e.document_id).filter(Boolean);
    if (docIds.length) await db().from('documents').update({ status: 'confirmed' }).in('id', docIds);
    // Closing a flag on confirm is the accountant's decision: confirming means "I looked at it".
    await db().from('flags').update({ open: false }).in('entry_id', ok.map((e) => e.id));
  }
  revalidatePath('/board', 'layout');
  return { confirmed: ok.length, skipped };
}

export async function retryDocument(documentId: string) {
  const { officeId } = await requireOffice();
  const { data: own } = await db().from('documents').select('id, clients!inner(office_id)').eq('id', documentId).eq('clients.office_id', officeId).maybeSingle();
  if (!own) return;
  await db().from('documents').update({ status: 'received', error: null }).eq('id', documentId);
  await enqueue('process_document', { documentId });
  after(() => drainWithRetries(supabaseJobStore(), handlers, { limit: 1, onDead }));
  revalidatePath('/board', 'layout');
}

/** Arabic reminder draft listing only what is missing. Empty string means nothing is missing. */
export async function draftReminderAction(clientId: string): Promise<string> {
  const { officeId } = await requireOffice();
  const row = (await loadBoard(officeId)).find((r) => r.id === clientId); // office-scoped: another office's id finds nothing
  if (!row) return '';
  const missing = row.counts.missing.length ? row.counts.missing : row.status === 'silent' ? ['إيصالات هذا الشهر'] : [];
  if (!missing.length) return '';
  return chatText(buildReminderMessages({ clientName: row.name, month: monthKey(new Date()), missing }));
}
