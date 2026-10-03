'use client';
import { useState } from 'react';
import type { Dict } from '@/i18n/dictionary';

const field =
  'w-full rounded-xl border border-foil/60 bg-note-deep/60 px-4 py-3 text-paper outline-none placeholder:text-paper/50 focus:border-foil';
const gold = 'w-full rounded-full bg-foil py-3 font-semibold text-note-deep hover:bg-paper';

type Props = {
  t: Dict['login'];
  next: string;
  demo: { email: string; password: string };
  signIn: (f: FormData) => void | Promise<void>;
  signUp: (f: FormData) => void | Promise<void>;
  startOnSignUp?: boolean;
};

// One panel, two modes: the sign-in form swaps into the create-account form in place.
export function AuthPanel({ t, next, demo, signIn, signUp, startOnSignUp }: Props) {
  const [mode, setMode] = useState<'in' | 'up'>(startOnSignUp ? 'up' : 'in');
  const tab = (m: 'in' | 'up', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${mode === m ? 'bg-foil text-note-deep' : 'text-paper/80 hover:text-foil'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex gap-1 rounded-full border border-foil/40 p-1">
        {tab('in', t.signIn)}
        {tab('up', t.createSummary)}
      </div>

      {mode === 'in' ? (
        <>
          <form action={signIn} className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <input name="email" type="email" required placeholder={t.email} className={field} dir="ltr" autoComplete="email" />
            <input name="password" type="password" required placeholder={t.password} className={field} dir="ltr" autoComplete="current-password" />
            <button className={gold}>{t.signIn}</button>
          </form>
          <form action={signIn} className="space-y-3 border-t border-foil/30 pt-5">
            <input type="hidden" name="next" value="/board?tour=1" />
            <input type="hidden" name="email" value={demo.email} />
            <input type="hidden" name="password" value={demo.password} />
            <p className="text-sm text-paper/70">{t.demoNote}</p>
            <button className="w-full rounded-full border border-foil py-3 font-semibold text-foil hover:bg-foil hover:text-note-deep">{t.demoBtn}</button>
          </form>
        </>
      ) : (
        <form action={signUp} className="space-y-3">
          <input name="email" type="email" required placeholder={t.email} className={field} dir="ltr" autoComplete="email" />
          <input name="password" type="password" required minLength={8} placeholder={t.passwordHint} className={field} dir="ltr" autoComplete="new-password" />
          <button className={gold}>{t.create}</button>
        </form>
      )}
    </div>
  );
}
