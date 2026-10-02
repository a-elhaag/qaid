import { cookies } from 'next/headers';
import { dictionaries, type Dict, type Lang } from './dictionary';

export const LANG_COOKIE = 'lang';

export async function getLang(): Promise<Lang> {
  return (await cookies()).get(LANG_COOKIE)?.value === 'ar' ? 'ar' : 'en';
}

export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}
