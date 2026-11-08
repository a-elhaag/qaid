import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { env } from '@/server/env';

/** Vercel cron hits this daily; one tiny read keeps the free Supabase project from auto-pausing (7 days idle). */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { error } = await db().from('offices').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
