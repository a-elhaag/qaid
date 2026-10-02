import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { drainWithRetries } from '@/server/jobs';
import { supabaseJobStore } from '@/server/jobStore';
import { handlers, onDead } from '@/server/processDocument';

export const maxDuration = 60;

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const n = await drainWithRetries(supabaseJobStore(), handlers, { limit: 10, onDead });
  return NextResponse.json({ ran: n });
}
