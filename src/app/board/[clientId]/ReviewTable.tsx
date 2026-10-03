'use client';
import { useState, useTransition } from 'react';
import { CATEGORIES } from '@/brain/config';
import type { Dict } from '@/i18n/dictionary';
import { confirmEntries, retryDocument, updateEntry } from '@/server/actions';

export interface ReviewRow {
  id: string;
  documentId: string | null;
  vendor: string;
  date: string;
  subtotal: number;
  vat: number;
  total: number;
  category: string;
  question: string | null;
  agreement: Record<string, string>;
  imageUrl: string | null;
  flags: string[];
}

const input = 'w-full rounded-lg border border-ink/30 bg-paper-hi px-2.5 py-1.5 text-sm outline-none focus:border-note';

export function ReviewTable({ rows, failed, t }: { rows: ReviewRow[]; failed: { id: string }[]; t: Dict['review'] }) {
  const [picked, setPicked] = useState<string[]>(rows.map((r) => r.id));
  const [skipped, setSkipped] = useState(0);
  const [pending, start] = useTransition();
  const live = picked.filter((id) => rows.some((r) => r.id === id)); // rows vanish after confirm
  const dis = (r: ReviewRow, f: string) => (r.agreement[f] === 'disputed' ? 'ring-2 ring-foil bg-[#f6ecc8]' : '');
  const label = 'mb-1 block font-mono text-[10px] uppercase tracking-[.14em] text-ink-soft';

  return (
    <section className="space-y-4">
      {failed.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-void px-4 py-3 text-sm text-void">
          {t.failed}
          <button className="font-semibold underline" onClick={() => start(() => retryDocument(d.id))}>{t.retry}</button>
        </div>
      ))}

      {rows.map((r) => (
        <article key={r.id} data-tour="review-row" className="grid gap-4 rounded-[var(--r)] border border-ink/40 bg-paper-hi p-4 sm:grid-cols-[auto_132px_1fr]">
          <input
            type="checkbox"
            aria-label={t.confirmSel}
            className="mt-1 h-5 w-5 accent-[var(--note)]"
            checked={picked.includes(r.id)}
            onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))}
          />
          {r.imageUrl ? (
            <a href={r.imageUrl} target="_blank" rel="noreferrer" aria-label={t.receipt}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.imageUrl} alt="" className="h-36 w-32 rounded-md bg-paper object-contain shadow-[0_8px_14px_-8px_#0007]" />
            </a>
          ) : (
            <span className="grid h-36 w-32 place-items-center rounded-md border border-dashed border-ink/30 text-xs text-ink-soft">{t.noImage}</span>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="col-span-2 sm:col-span-1">
              <span className={label}>{t.vendor}</span>
              <input defaultValue={r.vendor} className={`${input} ${dis(r, 'vendor')}`} onBlur={(e) => updateEntry(r.id, { vendor: e.target.value })} />
            </label>
            <label>
              <span className={label}>{t.date}</span>
              <input type="date" dir="ltr" defaultValue={r.date} className={`${input} ${dis(r, 'date')}`} onBlur={(e) => e.target.value && updateEntry(r.id, { entry_date: e.target.value })} />
            </label>
            <label>
              <span className={label}>{t.category}</span>
              <select defaultValue={r.category} className={input} onChange={(e) => updateEntry(r.id, { category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t.cats[c]}</option>
                ))}
              </select>
            </label>
            {(['subtotal', 'vat', 'total'] as const).map((f) => (
              <label key={f}>
                <span className={label}>{t[f]}</span>
                <input type="number" step="0.01" min="0" dir="ltr" defaultValue={r[f]} className={`${input} font-mono ${dis(r, f)}`} onBlur={(e) => updateEntry(r.id, { [f]: Number(e.target.value) })} />
              </label>
            ))}
            {Object.values(r.agreement).includes('disputed') && <p className="col-span-full text-xs text-ink-soft">{t.disputed}</p>}
            {r.question && <p className="col-span-full text-sm text-ink-soft">{r.question}</p>}
            {r.flags.map((f) => (
              <p key={f} className="col-span-full">
                <span className="inline-block -rotate-2 rounded-lg border-2 border-void px-2 py-1 font-mono text-xs font-semibold tracking-wide text-void rtl:rotate-2">{f}</span>
              </p>
            ))}
          </div>
        </article>
      ))}

      {rows.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            data-tour="confirm"
            disabled={pending || !live.length}
            onClick={() =>
              start(async () => {
                const res = await confirmEntries(live);
                setSkipped(res.skipped.length);
              })
            }
            className="rounded-full bg-note px-7 py-3 font-semibold text-paper hover:bg-note-deep disabled:opacity-50"
          >
            {t.confirmSel} ({live.length})
          </button>
          {skipped > 0 && <span className="text-sm text-void">{skipped} {t.skipped}</span>}
        </div>
      )}
    </section>
  );
}
