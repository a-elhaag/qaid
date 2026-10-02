import { db } from './db';
import type { Job, JobStore } from './jobs';

export async function enqueue(type: string, payload: Record<string, unknown>) {
  const { error } = await db().from('jobs').insert({ type, payload });
  if (error) throw error;
}

const must = ({ error }: { error: unknown }) => {
  if (error) throw error;
};

export const supabaseJobStore = (): JobStore => ({
  async claim() {
    const { data, error } = await db().rpc('claim_job');
    if (error) throw error;
    return data?.id ? ({ id: data.id, type: data.type, payload: data.payload, attempts: data.attempts } as Job) : null;
  },
  async nextRetryAt() {
    const { data, error } = await db().from('jobs').select('run_at').eq('status', 'retry').order('run_at').limit(1).maybeSingle();
    if (error) throw error;
    return data ? new Date(data.run_at) : null;
  },
  async complete(id) {
    must(await db().from('jobs').update({ status: 'done' }).eq('id', id));
  },
  async fail(id, error, retryAt) {
    must(await db().from('jobs').update(retryAt ? { status: 'retry', error, run_at: retryAt.toISOString() } : { status: 'dead', error }).eq('id', id));
  },
});
