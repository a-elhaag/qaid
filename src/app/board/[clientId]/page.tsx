import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Guilloche } from '@/components/Guilloche';
import { LangToggle } from '@/components/LangToggle';
import { getDict } from '@/i18n/server';
import { requireOffice } from '@/server/auth';
import { db } from '@/server/db';
import { LiveRefresh } from '../LiveRefresh';
import { ReviewTable, type ReviewRow } from './ReviewTable';

export const dynamic = 'force-dynamic';

export default async function ClientDetail({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { officeId } = await requireOffice();
  const { lang, t } = await getDict();
  const r = t.review;
  const { data: client } = await db().from('clients').select('id,name,name_en,token').eq('id', clientId).eq('office_id', officeId).maybeSingle();
  if (!client) notFound(); // also the answer for another office's client id

  const [{ data: docs }, { data: entries }, { data: flags }] = await Promise.all([
    db().from('documents').select('id,status,image_path').eq('client_id', clientId),
    db().from('entries').select('*').eq('client_id', clientId).order('entry_date', { ascending: false }),
    db().from('flags').select('entry_id,detail').eq('client_id', clientId).eq('open', true),
  ]);
  const toReview = (entries ?? []).filter((e) => !e.confirmed);
  const done = (entries ?? []).filter((e) => e.confirmed).slice(0, 12);
  const rows: ReviewRow[] = await Promise.all(
    toReview.map(async (e) => {
      const path = docs?.find((d) => d.id === e.document_id)?.image_path;
      const signed = path ? ((await db().storage.from('receipts').createSignedUrl(path, 3600)).data?.signedUrl ?? null) : null;
      return {
        id: e.id,
        documentId: e.document_id,
        vendor: e.vendor,
        date: e.entry_date,
        subtotal: Number(e.subtotal),
        vat: Number(e.vat),
        total: Number(e.total),
        category: e.category,
        question: e.question,
        agreement: e.agreement ?? {},
        imageUrl: signed,
        flags: (flags ?? []).filter((f) => f.entry_id === e.id).map((f) => f.detail),
      };
    }),
  );
  const nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const failed = (docs ?? []).filter((d) => d.status === 'failed');

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <LiveRefresh />
      <header className="relative overflow-hidden rounded-[var(--r)] bg-note px-5 py-6 text-paper sm:px-8">
        <Guilloche kind="band" w={1180} h={110} className="absolute inset-0 h-full w-full" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/board" className="font-mono text-xs tracking-[.14em] text-foil hover:underline">← {r.back}</Link>
            <h1 className="mt-2 font-disp text-3xl font-bold sm:text-4xl">{lang === 'ar' ? client.name : client.name_en || client.name}</h1>
            <p className="mt-2 font-mono text-xs tracking-[.08em] text-paper/70" dir="ltr">{r.uploadLink}: /c/{client.token}</p>
          </div>
          <LangToggle className="text-foil hover:bg-foil hover:text-note-deep" />
        </div>
      </header>

      <h2 className="font-disp text-2xl font-bold text-note">{r.toReview}</h2>
      {rows.length === 0 && failed.length === 0 && <p className="text-ink-soft">{r.nothing}</p>}
      <ReviewTable rows={rows} failed={failed} t={r} />

      {done.length > 0 && (
        <>
          <h2 className="pt-4 font-disp text-2xl font-bold text-note">{r.confirmed}</h2>
          <ul className="overflow-hidden rounded-[var(--r)] border border-ink/40 bg-paper-hi">
            {done.map((e) => (
              <li key={e.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-rule px-5 py-3 last:border-0">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#f6e3a1,var(--foil)_55%,#8c6d22)] text-note-deep" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
                <span>
                  <span className="font-semibold">{e.vendor}</span>
                  <span className="ms-3 font-mono text-xs text-ink-soft">{e.entry_date} · {r.cats[e.category as keyof typeof r.cats]}</span>
                </span>
                <span className="font-mono">{nf.format(Number(e.total))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
