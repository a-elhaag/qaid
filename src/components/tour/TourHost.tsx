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
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [pressed, setPressed] = useState(false);
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
    /** Glide the visible cursor onto an element (optionally inside the phone iframe) and wait for it to arrive. */
    const point = async (el: Element, inFrame = false) => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      await sleep(80);
      const r = el.getBoundingClientRect();
      const f = inFrame && frame.current ? frame.current.getBoundingClientRect() : { left: 0, top: 0 };
      setCursor({ x: f.left + r.left + Math.min(r.width * 0.5, 120), y: f.top + r.top + r.height * 0.5 });
      await sleep(650);
    };
    const press = async () => {
      setPressed(true);
      await sleep(180);
      setPressed(false);
    };
    /** Move to a real element, press, and click it for real. */
    const tap = async (el: HTMLElement, inFrame = false) => {
      await point(el, inFrame);
      await press();
      el.click();
    };
    /** Click a link or button and wait for the next page's marker element. */
    const nav = async (from: string, ready: string) => {
      const el = await until(() => q(from), 30000);
      await tap(el);
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
      setCursor({ x: window.innerWidth - 80, y: window.innerHeight - 140 });
      say(t.intro);
      await look(() => q('[data-tour=board]'));
      await sleep(3200);
      say(t.problems);
      const stamps = [...document.querySelectorAll('[data-tour=stamp]')].map((e) => e.closest('[role=row]')!).filter(Boolean);
      await look(() => stamps);
      for (const row of stamps) await point(row);
      await sleep(1200);
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
      await sleep(900);
      say(t.send);
      const btn = doc.querySelector<HTMLElement>('button[aria-label]');
      if (btn) {
        await point(btn, true);
        await press();
      }
      const win = frame.current!.contentWindow as unknown as { File: typeof File; DataTransfer: typeof DataTransfer; Event: typeof Event };
      const dt = new win.DataTransfer();
      dt.items.add(new win.File([await makeReceiptBlob()], 'photo.jpg', { type: 'image/jpeg' }));
      const input = doc.querySelector<HTMLInputElement>('input[type=file]')!;
      input.files = dt.files;
      input.dispatchEvent(new win.Event('change', { bubbles: true }));
      await until(() => doc.querySelector('section.bg-paper'), 30000);
      await sleep(1400);

      // 3. the live reading
      say(t.reading, true);
      setPhoneShown(false);
      const cafeRow = await until(() => q(`[data-tour=row-${info.cafe.id}]`));
      await look(() => cafeRow);
      await point(cafeRow);
      for (;;) {
        const s = (await (await fetch(`/api/demo/tour?since=${encodeURIComponent(since)}`)).json()) as Info;
        if (s.ready) break;
        if (s.failed) throw new Error('failed');
        await sleep(1500);
      }
      say(t.arrived);
      await sleep(2200);

      // 4. open the client, review and confirm
      await look(null);
      await tap((await until(() => q(`[data-tour=row-${info.cafe.id}]`)))!);
      await until(() => q('[data-tour=review-row]'), 40000);
      say(t.review);
      const rrow = q('[data-tour=review-row]')!;
      await look(() => q('[data-tour=review-row]'));
      await point(rrow);
      await sleep(3800);
      say(t.confirm);
      await look(() => q('[data-tour=confirm]'));
      await tap((await until(() => q('[data-tour=confirm]')))!);
      await until(() => !q('[data-tour=review-row]'), 25000);
      await sleep(1800);

      // 5. the chaser
      say(t.reminder);
      await look(() => q('[data-tour=reminder]'));
      await sleep(2400);
      await tap((await until(() => q('[data-tour=reminder-btn]')))!);
      await until(() => (q('[data-tour=reminder-text]') as HTMLTextAreaElement | null)?.value.length, 45000);
      await look(() => q('[data-tour=reminder]'));
      await sleep(3600);

      // 6. chat: back to the board, open Ask Qaid, type, send
      await look(null);
      await nav('[data-tour=back]', '[data-tour=ask]');
      await nav('[data-tour=ask]', '[data-tour=chat-input]');
      say(t.chat);
      const box = q('[data-tour=chat-input]') as HTMLInputElement;
      await point(box);
      await look(() => box.closest('form'));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      let typed = '';
      for (const ch of t.question) {
        typed += ch;
        setter.call(box, typed);
        box.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(38);
      }
      await sleep(300);
      await tap(q('[data-tour=chat-send]')!);
      await look(() => q('[data-tour=chat-answer]') ?? box.closest('form'), false);
      await until(() => q('[data-tour=chat-answer]'), 60000);
      for (let same = 0, last = -1; same < 3; ) {
        await sleep(1000);
        const len = q('[data-tour=chat-answer]')?.innerText.length ?? 0;
        same = len === last ? same + 1 : 0;
        last = len;
      }
      await sleep(2200);

      // 7. the month-end pack
      await look(null);
      await nav('[data-tour=back]', `[data-tour=row-${info.mona.id}]`);
      await nav(`[data-tour=row-${info.mona.id}]`, '[data-tour=export]');
      say(t.pack);
      await look(() => q('[data-tour=export]'));
      await point((await until(() => q('[data-tour=export] a')))!);
      await sleep(3200);
    } catch (e) {
      if (!(e instanceof Aborted)) setCaption(t.failed);
      if (!(e instanceof Aborted)) await tick(4000);
    } finally {
      const wasAborted = abort.current;
      target.current = null;
      setPhoneShown(false);
      setCursor(null);
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
  const barOnTop = !!spot && spot.y + spot.h / 2 > window.innerHeight * 0.55; // keep the caption clear of what it points at
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
      {cursor && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[110] transition-transform duration-[650ms] ease-[cubic-bezier(.4,0,.2,1)]"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <span className={`absolute -left-5 -top-5 h-10 w-10 rounded-full bg-foil/60 transition-all duration-150 ${pressed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
          <svg width="26" height="30" viewBox="0 0 26 30" className={`relative drop-shadow-[0_3px_3px_rgba(0,0,0,.45)] transition-transform duration-150 ${pressed ? 'scale-90' : ''}`}>
            <path d="M2 2 L2 23 L8 18 L12.5 28 L17 26 L12.5 16.5 L21 16 Z" fill="#f1ead6" stroke="#082f2b" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-x-3 ${barOnTop ? 'top-3' : 'bottom-3'} z-[100] mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] border border-foil bg-note-deep/95 px-5 py-4 text-paper shadow-[0_20px_40px_-12px_#000a] backdrop-blur`}
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
