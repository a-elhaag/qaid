import Link from 'next/link';
import { Guilloche } from '@/components/Guilloche';
import { LangToggle } from '@/components/LangToggle';
import { getDict } from '@/i18n/server';
import { requireOffice } from '@/server/auth';
import { Chat } from './Chat';

export default async function ChatPage() {
  await requireOffice();
  const { t } = await getDict();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 p-4 sm:p-8">
      <header className="relative overflow-hidden rounded-[var(--r)] bg-note px-5 py-5 text-paper sm:px-8">
        <Guilloche kind="band" w={1180} h={90} className="absolute inset-0 h-full w-full" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <Link href="/board" className="font-mono text-xs tracking-[.14em] text-foil hover:underline">← {t.board.title}</Link>
            <h1 className="mt-1 font-disp text-3xl font-bold">{t.chat.title}</h1>
          </div>
          <LangToggle className="text-foil hover:bg-foil hover:text-note-deep" />
        </div>
      </header>
      <Chat t={t.chat} />
    </main>
  );
}
