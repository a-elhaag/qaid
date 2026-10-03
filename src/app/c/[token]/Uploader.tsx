'use client';
import { useRef, useState, type ReactNode } from 'react';
import type { Dict } from '@/i18n/dictionary';
import type { Reason } from '@/brain/scan/quality';
import { checkAndCrop } from './scan';

type Props = { token: string; name: string; office: string; t: Dict['client']; lang: 'en' | 'ar'; art: ReactNode; toggle: ReactNode };

// The whole phone page: one foil button, then a "got it" screen. Nothing else.
export function Uploader({ token, name, office, t, art, toggle }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'retake'>('idle');
  const [reason, setReason] = useState<Reason>('blurry');
  const done = state === 'done';

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setState('sending');
    try {
      const form = new FormData();
      for (const f of Array.from(files)) {
        const r = await checkAndCrop(f);
        if (!r.ok && r.reason) {
          setReason(r.reason);
          setState('retake');
          if (input.current) input.current.value = '';
          return;
        }
        form.append('file', r.blob, 'receipt.jpg');
      }
      const r = await fetch(`/api/upload?token=${token}`, { method: 'POST', body: form });
      setState(r.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
    if (input.current) input.current.value = '';
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-note-deep sm:p-6">
      <section
        className={`relative flex min-h-dvh w-full max-w-md flex-col justify-between overflow-hidden p-6 sm:min-h-[640px] sm:rounded-[44px] sm:border-8 sm:border-ink ${done ? 'bg-paper text-note' : 'bg-note text-paper'}`}
      >
        <div className={done ? 'opacity-40 [&_svg]:!stroke-[var(--note)]' : ''}>{art}</div>

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className={`font-mono text-xs tracking-[.16em] ${done ? 'text-ink-soft' : 'text-foil'}`}>
              {done ? t.sent.toUpperCase() : `${t.from} ${office}`.toUpperCase()}
            </p>
            <h1 className="mt-2 font-disp text-4xl font-bold leading-tight">{done ? t.gotIt : `${t.hello}, ${name}`}</h1>
          </div>
          {toggle}
        </div>

        <div className="relative flex flex-col items-center gap-6 py-10">
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPick(e.target.files)} />
          <button
            onClick={() => input.current?.click()}
            disabled={state === 'sending'}
            aria-label={done ? t.another : t.send}
            className={`grid h-52 w-52 place-items-center rounded-full border-2 border-foil text-center font-disp text-2xl font-bold shadow-[0_0_0_10px_#c8a24a33,0_0_0_22px_#c8a24a1a] transition-transform active:scale-95 disabled:opacity-70 ${
              done ? 'bg-note text-foil' : 'bg-[radial-gradient(circle_at_35%_30%,#f6e3a1,var(--foil)_58%,#8c6d22)] text-note-deep'
            }`}
          >
            <span className="px-6">
              <svg viewBox="0 0 24 24" className="mx-auto mb-2 h-14 w-14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                {done ? <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2.2" /> : <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.6" /></>}
              </svg>
              {state === 'sending' ? t.sending : done ? t.another : t.send}
            </span>
          </button>
          {state === 'retake' && <p role="alert" className="max-w-[28ch] rounded-xl bg-foil px-4 py-3 text-center text-sm font-semibold text-note-deep">{t.retake[reason]}</p>}
          {state === 'error' && <p role="alert" className="max-w-[28ch] rounded-xl bg-void px-4 py-3 text-center text-sm text-paper">{t.error}</p>}
        </div>

        <p className={`relative text-center font-mono text-[11px] tracking-[.12em] ${done ? 'text-ink-soft' : 'text-paper/70'}`}>
          {done ? t.reassure : t.noAccount}
        </p>
      </section>
    </main>
  );
}
