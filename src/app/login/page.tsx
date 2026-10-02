import { DEMO } from '@/lib/demo';
import { getDict } from '@/i18n/server';
import { Guilloche } from '@/components/Guilloche';
import { LangToggle } from '@/components/LangToggle';
import { signIn, signUp } from './actions';

const field =
  'w-full rounded-xl border border-foil/60 bg-note-deep/60 px-4 py-3 text-paper outline-none placeholder:text-paper/50 focus:border-foil';
const gold = 'w-full rounded-full bg-foil py-3 font-semibold text-note-deep hover:bg-paper';

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; check?: string }> }) {
  const sp = await searchParams;
  const { t } = await getDict();
  const l = t.login;
  const err = sp.error === '1' ? l.bad : sp.error === '2' ? l.badSignup : sp.error === 'nooffice' ? l.noOffice : sp.error ? '!' : '';
  const next = <input type="hidden" name="next" value={sp.next ?? ''} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl items-center p-4 sm:p-8">
      <section className="relative w-full overflow-hidden rounded-[28px] border border-foil bg-note text-paper shadow-[0_18px_40px_-18px_#082f2b99,0_2px_6px_#082f2b66]">
        <Guilloche w={1000} h={620} className="absolute inset-0 h-full w-full" />
        <div className="relative grid gap-10 p-6 sm:p-12 md:grid-cols-[1.1fr_.9fr]">
          <div className="flex flex-col justify-between gap-10">
            <div className="flex items-start justify-between gap-4">
              <span className="font-mono text-xs tracking-[.22em] text-foil">QD 0472913</span>
              <LangToggle className="text-foil hover:bg-foil hover:text-note-deep" />
            </div>
            <div>
              <h1 className="font-disp text-[clamp(72px,14vw,150px)] font-bold leading-[.9] tracking-tight">{t.brand}</h1>
              <p className="mt-4 max-w-[28ch] font-disp text-xl text-foil sm:text-2xl">{t.tagline}</p>
            </div>
          </div>

          <div className="space-y-5 rounded-[22px] border border-foil/40 bg-note-deep/70 p-6 backdrop-blur-[2px]">
            {err && <p role="alert" className="rounded-xl border border-paper/40 bg-void px-4 py-3 text-sm">{err}</p>}
            {sp.check && <p className="text-sm text-foil">{l.check}</p>}

            <form action={signIn} className="space-y-3">
              {next}
              <input name="email" type="email" required placeholder={l.email} className={field} dir="ltr" autoComplete="email" />
              <input name="password" type="password" required placeholder={l.password} className={field} dir="ltr" autoComplete="current-password" />
              <button className={gold}>{l.signIn}</button>
            </form>

            <form action={signIn} className="space-y-3 border-t border-foil/30 pt-5">
              {next}
              <input type="hidden" name="email" value={DEMO.email} />
              <input type="hidden" name="password" value={DEMO.password} />
              <p className="text-sm text-paper/70">{l.demoNote}</p>
              <button className="w-full rounded-full border border-foil py-3 font-semibold text-foil hover:bg-foil hover:text-note-deep">{l.demoBtn}</button>
            </form>

            <details className="border-t border-foil/30 pt-4 text-sm text-paper/70">
              <summary className="cursor-pointer">{l.createSummary}</summary>
              <form action={signUp} className="mt-3 space-y-3">
                <input name="email" type="email" required placeholder={l.email} className={field} dir="ltr" autoComplete="email" />
                <input name="password" type="password" required minLength={8} placeholder={l.passwordHint} className={field} dir="ltr" autoComplete="new-password" />
                <button className="w-full rounded-full border border-paper/50 py-3 hover:border-foil hover:text-foil">{l.create}</button>
              </form>
            </details>
          </div>
        </div>
      </section>
    </main>
  );
}
