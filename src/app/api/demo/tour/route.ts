import { after, NextResponse } from 'next/server';
import { requireOffice } from '@/server/auth';
import { drainWithRetries } from '@/server/jobs';
import { supabaseJobStore } from '@/server/jobStore';
import { handlers, onDead } from '@/server/processDocument';
import { isDemoEmail, tourInfo } from '@/server/tour';

export const maxDuration = 60;

export async function GET(req: Request) {
  const { officeId, email } = await requireOffice();
  if (!isDemoEmail(email)) return NextResponse.json({ error: 'demo only' }, { status: 403 });
  const since = new URL(req.url).searchParams.get('since');
  const info = await tourInfo(officeId, since);
  if (!info) return NextResponse.json({ error: 'not seeded' }, { status: 404 });
  // The tour polls while a receipt is being read: also pick up any retry that has come due (a sweep, as pg_cron does in production).
  if (since && !info.ready && !info.failed) after(() => drainWithRetries(supabaseJobStore(), handlers, { limit: 1, budgetMs: 20_000, onDead }));
  return NextResponse.json(info);
}
