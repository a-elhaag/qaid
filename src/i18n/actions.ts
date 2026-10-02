'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LANG_COOKIE, getLang } from './server';

export async function toggleLang() {
  const next = (await getLang()) === 'ar' ? 'en' : 'ar';
  (await cookies()).set(LANG_COOKIE, next, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}
