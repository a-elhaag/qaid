export interface Job { id: string; type: string; payload: Record<string, unknown>; attempts: number }
export interface JobStore {
  claim(): Promise<Job | null>;
  complete(id: string): Promise<void>;
  fail(id: string, error: string, retryAt: Date | null): Promise<void>;
}
export type Handlers = Record<string, (payload: Record<string, unknown>) => Promise<void>>;
interface Opts { maxAttempts?: number; onDead?: (job: Job, error: string) => Promise<void> }

export async function runNext(store: JobStore, handlers: Handlers, opts: Opts = {}): Promise<boolean> {
  const max = opts.maxAttempts ?? 3;
  const job = await store.claim();
  if (!job) return false;
  try {
    const h = handlers[job.type];
    if (!h) throw new Error(`no handler for ${job.type}`);
    await h(job.payload);
    await store.complete(job.id);
  } catch (err) {
    const msg = String(err);
    if (job.attempts >= max) {
      await store.fail(job.id, msg, null);
      await opts.onDead?.(job, msg);
    } else {
      await store.fail(job.id, msg, new Date(Date.now() + 5000 * job.attempts));
    }
  }
  return true;
}

export async function drain(store: JobStore, handlers: Handlers, opts: Opts & { limit?: number } = {}): Promise<number> {
  let n = 0;
  while (n < (opts.limit ?? 10) && (await runNext(store, handlers, opts))) n++;
  return n;
}
