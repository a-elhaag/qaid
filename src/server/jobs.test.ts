import { describe, expect, it } from 'vitest';
import { drain, runNext, type Job, type JobStore } from './jobs';

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
