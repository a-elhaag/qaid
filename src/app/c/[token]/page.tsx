import { notFound } from 'next/navigation';
import { Guilloche } from '@/components/Guilloche';
import { LangToggle } from '@/components/LangToggle';
import { getDict } from '@/i18n/server';
import { db } from '@/server/db';
import { Uploader } from './Uploader';

export default async function ClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { lang, t } = await getDict();
  const { data: client } = await db().from('clients').select('name,name_en,offices(name)').eq('token', token).maybeSingle();
  if (!client) notFound();
  const office = (client.offices as unknown as { name: string } | null)?.name ?? '';
  const name = lang === 'ar' ? client.name : client.name_en || client.name;
  return (
    <Uploader
      token={token}
      name={name}
      office={office}
      t={t.client}
      lang={lang}
      art={<Guilloche w={420} h={820} className="absolute inset-0 h-full w-full" />}
      toggle={<LangToggle className="rounded-full border-2 border-foil px-5 py-2.5 text-sm font-semibold text-foil hover:bg-foil hover:text-note-deep" />}
    />
  );
}
