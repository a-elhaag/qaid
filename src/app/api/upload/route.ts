import { createHash, randomUUID } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { drain } from '@/server/jobs';
import { enqueue, supabaseJobStore } from '@/server/jobStore';
import { handlers, onDead } from '@/server/processDocument';

export const maxDuration = 60;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  const { data: client } = await db().from('clients').select('id').eq('token', token ?? '').maybeSingle();
  if (!client) return NextResponse.json({ error: 'unknown link' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'no file' }, { status: 400 });
  // validate everything before storing anything, so a bad file never leaves a partial batch
  if (files.some((f) => !f.type.startsWith('image/') || f.size > MAX_BYTES)) return NextResponse.json({ error: 'bad file' }, { status: 400 });
  const batchId = files.length > 1 ? randomUUID() : null;

  for (const f of files) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const path = `${client.id}/${randomUUID()}.jpg`;
    const up = await db().storage.from('receipts').upload(path, bytes, { contentType: f.type });
    if (up.error) return NextResponse.json({ error: 'storage' }, { status: 500 });
    const { data: doc, error } = await db()
      .from('documents')
      .insert({ client_id: client.id, image_path: path, image_hash: createHash('sha256').update(bytes).digest('hex'), batch_id: batchId })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'db' }, { status: 500 });
    await enqueue('process_document', { documentId: doc.id });
  }

  after(() => drain(supabaseJobStore(), handlers, { limit: 5, onDead }));
  return NextResponse.json({ ok: true, count: files.length });
}
