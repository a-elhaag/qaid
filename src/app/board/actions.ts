'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { requireOffice } from '@/server/auth';

export async function addClient(form: FormData) {
  const { officeId } = await requireOffice();
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  if (!name) return;
  await db().from('clients').insert({ office_id: officeId, name, name_en: name });
  revalidatePath('/board');
}
