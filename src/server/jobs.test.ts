import { describe, expect, it } from 'vitest';
import { drain, drainWithRetries, runNext, type Job, type JobStore } from './jobs';

function memStore(jobs: Job[]) {
  const log: string[] = [];
  const store: JobStore = {
    async claim() { const j = jobs.shift() ?? null; if (j) j.attempts += 1; return j; },
    async complete(id) { log.push(`done:${id}`); },
    async fail(id, _e, retryAt) { log.push(retryAt ? `retry:${id}` : `dead:${id}`); },
  };
  return { store, log };
}
const job = (id: string, attempts = 0): Job => ({ id, type: 't', payload: {}, attempts });

describe('runNext', () => {
  it('completes a successful job', async () => {
    const { store, log } = memStore([job('a')]);
    expect(await runNext(store, { t: async () => {} })).toBe(true);
    expect(log).toEqual(['done:a']);
  });
  it('returns false when queue empty', async () => {
    expect(await runNext(memStore([]).store, {})).toBe(false);
  });
  it('schedules a retry on failure before max attempts', async () => {
    const { store, log } = memStore([job('a')]);
    await runNext(store, { t: async () => { throw new Error('x'); } });
    expect(log).toEqual(['retry:a']);
  });
  it('goes dead after max attempts and calls onDead', async () => {
    const { store, log } = memStore([job('a', 2)]); // claim bumps to 3
    const dead: string[] = [];
    await runNext(store, { t: async () => { throw new Error('boom'); } }, { maxAttempts: 3, onDead: async (j, e) => { dead.push(`${j.id}:${e}`); } });
    expect(log).toEqual(['dead:a']);
    expect(dead[0]).toContain('boom');
  });
  it('unknown job type counts as failure', async () => {
    const { store, log } = memStore([job('a', 2)]);
    await runNext(store, {}, { maxAttempts: 3 });
    expect(log).toEqual(['dead:a']);
  });
});

describe('drain', () => {
  it('runs until empty or limit', async () => {
    const { store } = memStore([job('a'), job('b'), job('c')]);
    expect(await drain(store, { t: async () => {} }, { limit: 2 })).toBe(2);
  });
});

describe('drainWithRetries', () => {
  // store where a failed job is re-queued at retryAt
  function retryStore(maxAttempts: number) {
    const q: { id: string; attempts: number; at: number }[] = [{ id: 'a', attempts: 0, at: 0 }];
    const log: string[] = [];
    const store: JobStore = {
      async claim() { const j = q.find((x) => x.at <= Date.now()); if (!j) return null; q.splice(q.indexOf(j), 1); j.attempts += 1; return { id: j.id, type: 't', payload: {}, attempts: j.attempts }; },
      async complete(id) { log.push(`done:${id}`); },
      async fail(id, _e, retryAt) { log.push(retryAt ? `retry:${id}` : `dead:${id}`); if (retryAt) q.push({ id, attempts: log.filter((l) => l.startsWith('retry')).length, at: Date.now() + 10 }); },
      async nextRetryAt() { return q.length ? new Date(Math.min(...q.map((x) => x.at))) : null; },
    };
    return { store, log, maxAttempts };
  }
  it('retries until dead without outside help', async () => {
    const { store, log } = retryStore(3);
    await drainWithRetries(store, { t: async () => { throw new Error('x'); } }, { maxAttempts: 3, budgetMs: 2000 });
    expect(log).toEqual(['retry:a', 'retry:a', 'dead:a']);
  });
  it('stops when the next retry is beyond the budget', async () => {
    const { store, log } = retryStore(3);
    await drainWithRetries(store, { t: async () => { throw new Error('x'); } }, { maxAttempts: 3, budgetMs: 0 });
    expect(log).toEqual(['retry:a']);
  });
});
