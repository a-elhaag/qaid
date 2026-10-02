'use client';
import { useState, useTransition } from 'react';
import type { Dict } from '@/i18n/dictionary';
import { draftReminderAction } from '@/server/actions';

export function Reminder({ clientId, show, missing, t }: { clientId: string; show: boolean; missing: string[]; t: Dict['review'] }) {
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  if (!show) return null;
  return (
    <section className="space-y-3 rounded-[var(--r)] border-2 border-foil bg-[#f6ecc8] p-5">
      {missing.length > 0 && (
        <p className="text-sm">
          <span className="font-mono text-[11px] uppercase tracking-[.14em] text-ink-soft">{t.missingList}</span>
          <span className="ms-3 font-semibold">{missing.join(' · ')}</span>
        </p>
      )}
      <button
        disabled={pending}
        onClick={() => start(async () => setText(await draftReminderAction(clientId)))}
        className="rounded-full bg-note px-5 py-2 text-sm font-semibold text-paper hover:bg-note-deep disabled:opacity-60"
      >
        {pending ? t.reminding : t.remind}
      </button>
      {text !== null && (
        <>
          {/* The draft is Arabic whatever the UI language: clients read it on WhatsApp. */}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} dir="rtl" lang="ar" className="w-full rounded-xl border border-ink/30 bg-paper-hi p-3 text-sm outline-none focus:border-note" />
          <div className="flex items-center gap-4 text-sm">
            <button
              className="font-semibold underline"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              }}
            >
              {copied ? t.copied : t.copy}
            </button>
            <span className="text-ink-soft">{t.draftOnly}</span>
          </div>
        </>
      )}
    </section>
  );
}
