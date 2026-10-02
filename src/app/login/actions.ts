'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { safeNext } from '@/server/authRules';

export async function signIn(form: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) });
  if (error) redirect('/login?error=1');
  redirect(safeNext(String(form.get('next') ?? '')));
}

export async function signUp(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || password.length < 8) redirect('/login?error=2');
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error?.code === 'user_already_exists' || /already registered/i.test(error?.message ?? '')) redirect('/login?error=3');
  if (error || !data.user) redirect('/login?error=2');
  const { data: office } = await db().from('offices').insert({ name: email }).select('id').single();
  await db().from('office_members').insert({ user_id: data.user.id, office_id: office!.id });
  if (!data.session) redirect('/login?check=1'); // email confirmation is on
  redirect('/board');
}

export async function signOut() {
  await (await supabaseServer()).auth.signOut();
  redirect('/login');
}
