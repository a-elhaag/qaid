import { DEMO } from '@/lib/demo';
import { getDict } from '@/i18n/server';
import { Guilloche } from '@/components/Guilloche';
import { LogoMark } from '@/components/Logo';
import { LangToggle } from '@/components/LangToggle';
import { AuthPanel } from './AuthPanel';
import { signIn, signUp } from './actions';


export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; check?: string }> }) {
  const sp = await searchParams;
  const { t } = await getDict();
  const l = t.login;
  const err = sp.error === '1' ? l.bad : sp.error === '2' ? l.badSignup : sp.error === '3' ? l.exists : sp.error === 'nooffice' ? l.noOffice : sp.error ? '!' : '';

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl items-center p-4 sm:p-8">
      <section className="relative w-full overflow-hidden rounded-[28px] border border-foil bg-note text-paper shadow-[0_18px_40px_-18px_#082f2b99,0_2px_6px_#082f2b66]">
        <Guilloche w={1000} h={620} className="absolute inset-0 h-full w-full" />
        <div className="relative grid gap-10 p-6 sm:p-12 md:grid-cols-[1.1fr_.9fr]">
          <div className="flex flex-col justify-between gap-10">
            <div className="flex items-start justify-between gap-4">
              <span className="font-mono text-xs tracking-[.22em] text-foil">QD 0472913</span>
              <LangToggle className="rounded-full border-2 border-foil px-5 py-2.5 text-sm font-semibold text-foil hover:bg-foil hover:text-note-deep" />
            </div>
            <div>
              <LogoMark size={72} tile={false} className="mb-4" />
              <h1 className="font-disp text-[clamp(72px,14vw,150px)] font-bold leading-[.9] tracking-tight">{t.brand}</h1>
              <p className="mt-4 max-w-[28ch] font-disp text-xl text-foil sm:text-2xl">{t.tagline}</p>
            </div>
          </div>

          <div className="space-y-5 rounded-[22px] border border-foil/40 bg-note-deep/70 p-6 backdrop-blur-[2px]">
            {err && <p role="alert" className="rounded-xl border border-paper/40 bg-void px-4 py-3 text-sm">{err}</p>}
            {sp.check && <p className="text-sm text-foil">{l.check}</p>}

            <AuthPanel t={l} next={sp.next ?? ''} demo={DEMO} signIn={signIn} signUp={signUp} startOnSignUp={sp.error === '2'} />
          </div>
        </div>
      </section>
    </main>
  );
}
