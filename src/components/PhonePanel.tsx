'use client';
import { useEffect, useState } from 'react';
import type { Dict } from '@/i18n/dictionary';

type C = { id: string; name: string; nameEn: string; token: string };

/** Opens the client-facing phone page in a phone frame, with a QR code for a real phone. */
export function PhonePanel({ clients, initialId, lang, t, className = '' }: { clients: C[]; initialId?: string; lang: 'en' | 'ar'; t: Dict['scan']; className?: string }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(initialId ?? clients[0]?.id);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const client = clients.find((c) => c.id === id) ?? clients[0];
  const url = client && typeof window !== 'undefined' ? `${location.origin}/c/${client.token}` : '';

  useEffect(() => {
    if (!open || !url) return;
    let live = true;
    import('qrcode').then((m) => m.toDataURL(url, { margin: 1, width: 240, color: { dark: '#082f2b', light: '#f8f3e4' } })).then((d) => live && setQr(d));
    return () => {
      live = false;
    };
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  if (!clients.length) return null;
  return (
    <>
      <button type="button" data-tour="scan" onClick={() => setOpen(true)} className={className}>
        {t.open}
      </button>
      {open && client && (
        <div role="dialog" aria-modal="true" aria-label={t.title} className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-note-deep/70 p-4 text-start text-base font-normal text-ink backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="grid w-full max-w-3xl gap-6 rounded-[28px] border border-foil bg-paper p-5 shadow-[0_30px_60px_-20px_#000a] sm:grid-cols-[300px_1fr] sm:p-7">
            <div className="mx-auto h-[580px] w-[290px] overflow-hidden rounded-[44px] border-8 border-ink bg-note">
              <iframe key={client.id} src={`/c/${client.token}`} title={t.title} className="h-full w-full border-0" />
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-disp text-3xl font-bold text-note">{t.title}</h2>
                <button onClick={() => setOpen(false)} className="rounded-full border border-ink/40 px-4 py-1.5 text-sm hover:border-note">{t.close}</button>
              </div>
              <p className="text-ink-soft">{t.lead}</p>
              {clients.length > 1 && (
                <div>
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-[.14em] text-ink-soft">{t.client}</p>
                  <div className="flex flex-wrap gap-2">
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setId(c.id)}
                        aria-pressed={c.id === client.id}
                        className={`rounded-full border px-4 py-1.5 text-sm ${c.id === client.id ? 'border-note bg-note text-paper' : 'border-ink/30 hover:border-note'}`}
                      >
                        {lang === 'ar' ? c.name : c.nameEn}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 rounded-[var(--r)] border border-ink/20 bg-paper-hi p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr ? <img src={qr} alt="" className="h-28 w-28" /> : <span className="h-28 w-28" />}
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="text-ink-soft">{t.qrHint}</p>
                  <p dir="ltr" className="break-all font-mono text-xs">{url}</p>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                    }}
                    className="font-semibold underline"
                  >
                    {copied ? t.copied : t.copy}
                  </button>
                </div>
              </div>
              <p className="text-sm text-ink-soft">{t.samples}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
