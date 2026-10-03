'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Dict } from '@/i18n/dictionary';
import { endTour } from '@/server/tourActions';
import { makeReceiptBlob } from './receipt';

type T = Dict['tour'];
type Rect = { x: number; y: number; w: number; h: number };
type Target = Element | Element[] | null;
type Info = { now: string; cafe: { id: string; token: string }; mona: { id: string }; ready: boolean; failed: boolean };

const SINCE_KEY = 'qaid-tour-since'; // lets a later page load clean up after a tour that was cut short
const STEPS = 12;
const STALE_MS = 6 * 60_000; // a tour takes about 3 minutes, so older marks belong to a tour that was cut short

class Aborted extends Error {}
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
const q = (sel: string) => document.querySelector<HTMLElement>(sel);

function union(t: Target): Rect | null {
  const els = (Array.isArray(t) ? t : t ? [t] : []).filter(Boolean);
  if (!els.length) return null;
  const rs = els.map((e) => e.getBoundingClientRect());
  const x = Math.min(...rs.map((r) => r.left));
  const y = Math.min(...rs.map((r) => r.top));
  return { x, y, w: Math.max(...rs.map((r) => r.right)) - x, h: Math.max(...rs.map((r) => r.bottom)) - y };
}

/** Auto-playing demo tour. Lives in the root layout so it keeps running while pages change under it. */
export function TourHost({ t }: { t: T }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const sp = useSearchParams();
  const path = usePathname();
  const running = useRef(false);
  const abort = useRef(false);
  const paused = useRef(false);
  const target = useRef<(() => Target) | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const [on, setOn] = useState(false);
  const [caption, setCaption] = useState('');
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneShown, setPhoneShown] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [finale, setFinale] = useState(false);

  // keep the spotlight glued to its target (layout shifts, refreshes, scrolling)
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setSpot(target.current ? union(target.current()) : null), 150);
    return () => clearInterval(id);
  }, [on]);

  useEffect(() => {
    if (window.self !== window.top || running.current) return; // never inside the phone preview iframe
    const fresh = sp.get('tour') === '1' && path === '/board';
    const stale = localStorage.getItem(SINCE_KEY);
    if (!fresh) {
      const old = stale && Date.now() - Date.parse(stale) > STALE_MS;
      if (old && (path.startsWith('/board') || path.startsWith('/chat'))) endTour(stale).finally(() => localStorage.removeItem(SINCE_KEY));
      return;
    }
    running.current = true;
    history.replaceState(null, '', '/board');
    void run(stale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, path]);

  async function run(stale: string | null) {
    const sleep = async (ms: number) => {
      // measured against the real clock, so throttled background timers cannot stretch a pause
      let last = Date.now();
      for (let left = ms; left > 0; ) {
        if (abort.current) throw new Aborted();
        await tick(100);
        const now = Date.now();
        if (!paused.current) left -= now - last;
        last = now;
      }
    };
    const until = async <V,>(fn: () => V | null | undefined | false, timeout = 20000): Promise<V> => {
      const t0 = Date.now();
      for (;;) {
        if (abort.current) throw new Aborted();
        const v = fn();
        if (v) return v;
        if (Date.now() - t0 > timeout) throw new Error('timeout');
        await tick(200);
      }
    };
    const say = (text: string, isLive = false) => {
      setCaption(text);
      setLive(isLive);
      setStep((n) => n + 1);
    };
    const look = async (get: (() => Target) | null, scroll = true) => {
      target.current = get;
      if (get && scroll) {
        const el = await until(() => {
          const v = get();
          return (Array.isArray(v) ? v[0] : v) ?? null;
        });
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    const go = async (path: string, ready: string) => {
      routerRef.current.push(path);
      await until(() => q(ready), 40000);
    };

    let since = '';
    try {
      if (stale) await endTour(stale); // leftovers from a tour that was cut short
      setOn(true);
      const first = (await (await fetch('/api/demo/tour')).json()) as Info;
      since = first.now;
      localStorage.setItem(SINCE_KEY, since);
      const info = first;

      // 1. the board and its stories
      say(t.intro);
      await look(() => q('[data-tour=board]'));
      await sleep(5500);
      say(t.problems);
      await look(() => [...document.querySelectorAll('[data-tour=stamp]')].map((e) => e.closest('[role=row]')!).filter(Boolean));
      await sleep(6500);
      await look(null);

      // 2. a client's phone: the real client page, driven by the tour
      say(t.phone);
      setPhone(`/c/${info.cafe.token}`);
      await tick(300);
      setPhoneShown(true);
      const doc = await until(() => {
        const d = frame.current?.contentDocument;
        return d?.querySelector('input[type=file]') ? d : null;
      }, 40000);
      await sleep(2500);
      say(t.send);
      const btn = doc.querySelector<HTMLElement>('button[aria-label]');
      if (btn && frame.current) {
        const f = frame.current.getBoundingClientRect();
        const b = btn.getBoundingClientRect();
        setRipple({ x: f.left + b.left + b.width / 2, y: f.top + b.top + b.height / 2 });
        await sleep(1100);
        setRipple(null);
      }
      const win = frame.current!.contentWindow as unknown as { File: typeof File; DataTransfer: typeof DataTransfer; Event: typeof Event };
      const dt = new win.DataTransfer();
      dt.items.add(new win.File([await makeReceiptBlob()], 'photo.jpg', { type: 'image/jpeg' }));
      const input = doc.querySelector<HTMLInputElement>('input[type=file]')!;
      input.files = dt.files;
      input.dispatchEvent(new win.Event('change', { bubbles: true }));
      await until(() => doc.querySelector('section.bg-paper'), 30000);
      await sleep(2500);

      // 3. the live reading
      say(t.reading, true);
      setPhoneShown(false);
      await look(() => q(`[data-tour=row-${info.cafe.id}]`));
      for (;;) {
        const s = (await (await fetch(`/api/demo/tour?since=${encodeURIComponent(since)}`)).json()) as Info;
        if (s.ready) break;
        if (s.failed) throw new Error('failed');
        await sleep(2000);
      }
      say(t.arrived);
      await sleep(4500);

      // 4. review and confirm
      await look(null);
      await go(`/board/${info.cafe.id}`, '[data-tour=review-row]');
      say(t.review);
      await look(() => q('[data-tour=review-row]'));
      await sleep(7500);
      say(t.confirm);
      await look(() => q('[data-tour=confirm]'));
      await sleep(3000);
      q('[data-tour=confirm]')?.click();
      await until(() => !q('[data-tour=review-row]'), 25000);
      await sleep(3500);

      // 5. the chaser
      say(t.reminder);
      await look(() => q('[data-tour=reminder]'));
      await sleep(5000);
      q('[data-tour=reminder-btn]')?.click();
      await until(() => (q('[data-tour=reminder-text]') as HTMLTextAreaElement | null)?.value.length, 45000);
      await look(() => q('[data-tour=reminder]'));
      await sleep(6500);

      // 6. chat
      await look(null);
      await go('/chat', '[data-tour=chat-input]');
      say(t.chat);
      const box = q('[data-tour=chat-input]') as HTMLInputElement;
      await look(() => box.closest('form'));
      await sleep(2500);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      let typed = '';
      for (const ch of t.question) {
        typed += ch;
        setter.call(box, typed);
        box.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(45);
      }
      await sleep(600);
      q('[data-tour=chat-send]')?.click();
      await look(() => q('[data-tour=chat-answer]') ?? box.closest('form'), false);
      await until(() => q('[data-tour=chat-answer]'), 60000);
      for (let same = 0, last = -1; same < 4; ) {
        await sleep(1000);
        const len = q('[data-tour=chat-answer]')?.innerText.length ?? 0;
        same = len === last ? same + 1 : 0;
        last = len;
      }
      await sleep(3500);

      // 7. the month-end pack
      await look(null);
      await go(`/board/${info.mona.id}`, '[data-tour=export]');
      say(t.pack);
      await look(() => q('[data-tour=export]'));
      await sleep(6000);
    } catch (e) {
      if (!(e instanceof Aborted)) setCaption(t.failed);
      if (!(e instanceof Aborted)) await tick(4000);
    } finally {
      const wasAborted = abort.current;
      target.current = null;
      setPhoneShown(false);
      setRipple(null);
      setLive(false);
      if (since) {
        setCaption(t.tidy);
        try {
          await endTour(since);
          localStorage.removeItem(SINCE_KEY);
        } catch {
          /* the next page load retries from localStorage */
        }
      }
      routerRef.current.push('/board');
      if (wasAborted) {
        setOn(false);
        abort.current = false;
        running.current = false;
      } else {
        setStep(STEPS);
        setCaption(t.done);
        setFinale(true);
      }
    }
  }

  function close() {
    setOn(false);
    setFinale(false);
    running.current = false;
    abort.current = false;
    paused.current = false;
    setIsPaused(false);
    setStep(0);
    setPhone(null);
  }

  if (!on) return null;
  const pad = 10;
  return (
    <>
      {spot && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[90] rounded-2xl ring-2 ring-foil shadow-[0_0_0_9999px_rgba(8,47,43,0.55)] transition-all duration-500"
          style={{ left: spot.x - pad, top: spot.y - pad, width: spot.w + pad * 2, height: spot.h + pad * 2 }}
        />
      )}

      {phone && (
        <div
          aria-hidden
          className={`fixed end-4 top-1/2 z-[95] h-[580px] w-[290px] -translate-y-1/2 overflow-hidden rounded-[44px] border-8 border-ink bg-note shadow-[0_30px_60px_-20px_#000a] transition-all duration-700 sm:end-10 ${
            phoneShown ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'
          }`}
        >
          <iframe ref={frame} src={phone} title="client phone" className="pointer-events-none h-full w-full border-0" />
        </div>
      )}
      {ripple && <span aria-hidden className="pointer-events-none fixed z-[96] h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-foil/70" style={{ left: ripple.x, top: ripple.y }} />}

      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] border border-foil bg-note-deep/95 px-5 py-4 text-paper shadow-[0_20px_40px_-12px_#000a] backdrop-blur"
      >
        {live && <span className="rounded-full bg-void px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[.2em]">{t.live}</span>}
        <p className="min-w-[14rem] flex-1 text-[15px] leading-snug">{caption}</p>
        {finale ? (
          <div className="flex gap-2">
            <button onClick={close} className="rounded-full bg-foil px-5 py-2 text-sm font-semibold text-note-deep hover:bg-paper">{t.explore}</button>
            <button
              onClick={() => {
                close();
                setTimeout(() => (location.href = '/board?tour=1'), 50);
              }}
              className="rounded-full border border-foil px-5 py-2 text-sm font-semibold text-foil hover:bg-foil hover:text-note-deep"
            >
              {t.replay}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                paused.current = !paused.current;
                setIsPaused(paused.current);
              }}
              className="rounded-full border border-paper/40 px-4 py-2 text-sm hover:border-foil hover:text-foil"
            >
              {isPaused ? t.resume : t.pause}
            </button>
            <button onClick={() => (abort.current = true)} className="rounded-full border border-paper/40 px-4 py-2 text-sm hover:border-foil hover:text-foil">{t.skip}</button>
          </div>
        )}
        <div className="h-1 w-full overflow-hidden rounded-full bg-paper/15" aria-hidden>
          <div className="h-full bg-foil transition-all duration-700" style={{ width: `${Math.min(100, (step / STEPS) * 100)}%` }} />
        </div>
      </div>
    </>
  );
}
