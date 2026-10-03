'use client';
import { useEffect, useRef, useState } from 'react';
import type { Dict } from '@/i18n/dictionary';

type M = { role: 'user' | 'assistant'; content: string };

// **bold** only; everything else stays plain text.
const rich = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));

export function Chat({ t }: { t: Dict['chat'] }) {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  async function send(q: string) {
    if (!q.trim() || busy) return;
    const next: M[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setText('');
    setErr(false);
    setBusy(true);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      if (!r.ok || !r.body) throw new Error();
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let answer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += value;
        setMsgs([...next, { role: 'assistant', content: answer }]);
      }
      if (!answer) throw new Error();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex-1 space-y-3">
        {!msgs.length &&
          t.suggest.map((s) => (
            <button key={s} onClick={() => send(s)} className="block w-full rounded-[var(--r)] border border-ink/30 bg-paper-hi px-5 py-3 text-start hover:border-note hover:bg-[#e9efdc]">
              {s}
            </button>
          ))}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="ms-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-[var(--r)] bg-note px-5 py-3 text-paper">{m.content}</p>
          ) : (
            <p key={i} data-tour="chat-answer" className="max-w-[92%] whitespace-pre-wrap rounded-[var(--r)] border border-foil bg-paper-hi px-5 py-3 leading-relaxed">{rich(m.content)}</p>
          ),
        )}
        {busy && msgs[msgs.length - 1]?.role === 'user' && <p className="font-mono text-sm text-ink-soft">{t.thinking}...</p>}
        {err && <p role="alert" className="w-fit rounded-xl bg-void px-4 py-2 text-sm text-paper">{t.error}</p>}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="sticky bottom-4 flex gap-2 rounded-full border border-ink/40 bg-paper-hi p-1.5 shadow-[0_10px_24px_-14px_#082f2b99]"
      >
        <input data-tour="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} className="min-w-0 flex-1 bg-transparent px-4 outline-none" />
        <button data-tour="chat-send" disabled={busy} className="rounded-full bg-note px-6 py-2.5 font-semibold text-paper hover:bg-note-deep disabled:opacity-50">{t.send}</button>
      </form>
      <p className="text-center font-mono text-[11px] tracking-[.1em] text-ink-soft">{t.note}</p>
    </div>
  );
}
