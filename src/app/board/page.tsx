import Link from 'next/link';
import { Flaps } from '@/components/Flaps';
import { Guilloche } from '@/components/Guilloche';
import { LangToggle } from '@/components/LangToggle';
import { getDict } from '@/i18n/server';
import { requireOffice } from '@/server/auth';
import { loadBoard } from '@/server/queries';
import { signOut } from '../login/actions';
import { isDemoEmail } from '@/server/tour';
import { addClient } from './actions';
import { LiveRefresh } from './LiveRefresh';

export const dynamic = 'force-dynamic';

const ORDER = ['strange', 'missing', 'silent', 'review', 'ready'] as const;
const GRID = 'grid grid-cols-[1fr_auto] items-center gap-x-4 sm:grid-cols-[84px_1fr_92px_92px_72px_150px]';

export default async function Board() {
  const { officeId, email } = await requireOffice();
  const { lang, t } = await getDict();
  const b = t.board;
  const rows = (await loadBoard(officeId)).sort((a, c) => ORDER.indexOf(a.status) - ORDER.indexOf(c.status));
  const nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en', { useGrouping: false });
  const flap = (n: number) => {
    const s = nf.format(n);
    return s.length < 2 ? nf.format(0) + s : s;
  };
  const serial = (id: string) => `QD-${String(parseInt(id.slice(0, 4), 16) % 10000).padStart(4, '0')}`;
  const total = rows.reduce((n, r) => n + r.counts.review, 0);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <LiveRefresh />
      <section className="overflow-hidden rounded-[var(--r)] border border-ink bg-paper-hi">
        <header className="relative flex flex-wrap items-center justify-between gap-4 bg-note px-5 py-5 text-paper sm:px-8">
          <Guilloche kind="band" w={1180} h={90} className="absolute inset-0 h-full w-full" />
          <div className="relative">
            <p className="font-disp text-3xl font-bold leading-none">{t.brand}</p>
            <p className="mt-1 font-mono text-xs tracking-[.18em] text-foil">{b.title}</p>
          </div>
          <div className="relative flex items-center gap-4">
            <div className="text-end">
              <Flaps value={flap(total)} hot />
              <p className="mt-1 text-xs text-paper/80">{b.toReview}</p>
            </div>
            <Link href="/chat" data-tour="ask" className="rounded-full bg-foil px-4 py-2 text-sm font-semibold text-note-deep hover:bg-paper">{b.ask}</Link>
            {isDemoEmail(email) && <Link href="/board?tour=1" className="rounded-full border border-foil px-4 py-2 text-sm font-semibold text-foil hover:bg-foil hover:text-note-deep">{b.replay}</Link>}
            <LangToggle className="text-foil hover:bg-foil hover:text-note-deep" />
            <form action={signOut}>
              <button className="rounded-full border border-paper/50 px-4 py-2 text-sm hover:border-foil hover:text-foil">{b.signOut}</button>
            </form>
          </div>
        </header>

        <div role="table" aria-label={b.title} data-tour="board">
          <div role="row" className={`${GRID} border-b-2 border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[.14em] text-ink-soft sm:px-8`}>
            <span role="columnheader" className="hidden sm:block">{b.cols.no}</span>
            <span role="columnheader">{b.cols.client}</span>
            <span role="columnheader" className="hidden sm:block">{b.cols.review}</span>
            <span role="columnheader" className="hidden sm:block">{b.cols.flags}</span>
            <span role="columnheader" className="hidden sm:block">{b.cols.missing}</span>
            <span role="columnheader">{b.cols.status}</span>
          </div>
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/board/${r.id}`}
              role="row"
              data-tour={`row-${r.id}`}
              className={`${GRID} min-h-16 border-b border-rule px-5 py-3 transition-colors hover:bg-[#e9efdc] sm:px-8`}
            >
              <span role="cell" className="hidden font-mono text-xs tracking-[.14em] text-ink-soft sm:block">{serial(r.id)}</span>
              <span role="cell" className="font-disp text-lg font-bold">{lang === 'ar' ? r.name : r.nameEn}</span>
              <span role="cell" className="hidden sm:block"><Flaps value={flap(r.counts.review)} hot={r.counts.review > 0} /></span>
              <span role="cell" className="hidden sm:block"><Flaps value={flap(r.counts.flags)} /></span>
              <span role="cell" className="hidden font-mono text-sm sm:block">{nf.format(r.counts.missing.length)}</span>
              <span role="cell">
                {r.status === 'strange' ? (
                  <span data-tour="stamp" className="inline-block -rotate-3 rounded-lg border-2 border-void px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-void rtl:rotate-3">{b.status.strange}</span>
                ) : (
                  <span className={`text-sm ${r.status === 'ready' || r.status === 'review' ? 'font-semibold text-note' : 'text-ink-soft'}`}>{b.status[r.status]}</span>
                )}
              </span>
            </Link>
          ))}
          {!rows.length && <p className="px-8 py-12 text-ink-soft">{b.empty}</p>}
        </div>

        <form action={addClient} className="flex flex-wrap gap-3 border-t border-ink bg-paper px-5 py-4 sm:px-8">
          <input name="name" required maxLength={80} placeholder={b.addName} className="min-w-0 flex-1 rounded-full border border-ink/40 bg-paper-hi px-5 py-2.5 outline-none focus:border-note" />
          <button className="rounded-full bg-note px-6 py-2.5 font-semibold text-paper hover:bg-note-deep">{b.add}</button>
        </form>
      </section>
      <p className="mt-4 text-center font-mono text-[11px] tracking-[.12em] text-ink-soft">{b.synthetic}</p>
    </main>
  );
}
