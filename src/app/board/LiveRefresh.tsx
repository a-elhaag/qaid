'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const sb = supabaseBrowser(); // carries the user's JWT, so RLS limits events to their office
    const ch = sb.channel('live');
    for (const table of ['documents', 'entries', 'flags']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => router.refresh());
    ch.subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [router]);
  return null;
}
