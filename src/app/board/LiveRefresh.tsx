'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

const POLL_MS = 4000;

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseBrowser(); // carries the user's JWT, so RLS limits events to their office
    const ch = sb.channel('live');
    for (const table of ['documents', 'entries', 'flags']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => router.refresh());
    ch.subscribe();
    // Fallback: Realtime delivered no events for our RLS-protected tables in testing, so also refresh on a short timer while the tab is visible.
    const tick = () => document.visibilityState === 'visible' && router.refresh();
    const t = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick); // catch up as soon as the tab is shown again
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
      sb.removeChannel(ch);
    };
  }, [router]);
  return null;
}
