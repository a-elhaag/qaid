import { DEMO } from '@/lib/demo';
import { db } from './db';

export const isDemoEmail = (email: string) => email.toLowerCase() === DEMO.email;

/** The clients the tour drives, looked up by their English names inside the caller's own (demo) office. */
export async function tourInfo(officeId: string, since: string | null) {
  const { data: cs } = await db().from('clients').select('id,name_en,token').eq('office_id', officeId).in('name_en', ['Nile Cafe', 'Mona Home Goods']);
  const cafe = cs?.find((c) => c.name_en === 'Nile Cafe');
  const mona = cs?.find((c) => c.name_en === 'Mona Home Goods');
  if (!cafe || !mona) return null;
  let ready = false;
  let failed = false;
  if (since) {
    const { data: docs } = await db().from('documents').select('status').eq('client_id', cafe.id).gte('created_at', since);
    ready = !!docs?.some((d) => d.status === 'needs_review' || d.status === 'confirmed');
    failed = !!docs?.length && docs.every((d) => d.status === 'failed');
  }
  return { now: new Date().toISOString(), cafe: { id: cafe.id, token: cafe.token }, mona: { id: mona.id }, ready, failed };
}

/** Removes what the tour created: documents (and their entries, flags, image files) on Nile Cafe made since `since`. Each row is deleted by id. */
export async function tourCleanup(officeId: string, since: string) {
  const { data: cafe } = await db().from('clients').select('id').eq('office_id', officeId).eq('name_en', 'Nile Cafe').maybeSingle();
  if (!cafe) return 0;
  const { data: docs } = await db().from('documents').select('id,image_path').eq('client_id', cafe.id).gte('created_at', since);
  for (const d of docs ?? []) {
    const { data: es } = await db().from('entries').select('id').eq('document_id', d.id);
    for (const e of es ?? []) await db().from('entries').delete().eq('id', e.id); // flags cascade
    if (d.image_path) await db().storage.from('receipts').remove([d.image_path]);
    await db().from('documents').delete().eq('id', d.id);
  }
  return docs?.length ?? 0;
}
