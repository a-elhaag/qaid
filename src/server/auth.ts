import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { db } from './db';

export { assertSameOffice, safeNext } from './authRules';

export async function requireOffice(): Promise<{ userId: string; officeId: string }> {
  const {
    data: { user },
  } = await (await supabaseServer()).auth.getUser();
  if (!user) redirect('/login');
  const { data } = await db().from('office_members').select('office_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!data) redirect('/login?error=nooffice');
  return { userId: user.id, officeId: data.office_id as string };
}
