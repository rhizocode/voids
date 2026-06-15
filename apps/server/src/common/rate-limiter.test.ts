import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, fetchJson } from './rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces requests to the configured rate once the burst is spent', async () => {
    // Drive the limiter's clock + timer from fake timers.
    const limiter = new RateLimiter(
      { ratePerSecond: 10, burst: 1, concurrency: 10 },
      {
        now: () => Date.now(),
        setTimer: (cb, ms) => void setTimeout(cb, ms),
      },
    );

    const completions: number[] = [];
    const start = Date.now();
    const run = (i: number) =>
      limiter.run(async () => {
        completions.push(Date.now() - start);
        return i;
      });

    // Fire 3 tasks. Burst=1 -> first immediate, then ~100ms apart at 10/s.
    const p = Promise.all([run(0), run(1), run(2)]);

    await vi.advanceTimersByTimeAsync(0);
    expect(completions).toEqual([0]); // only the burst token

    await vi.advanceTimersByTimeAsync(100);
    expect(completions.length).toBe(2);

    await vi.advanceTimersByTimeAsync(100);
    expect(completions.length).toBe(3);

    await p;
    // Second + third completions are at least ~100ms and ~200ms in.
    expect(completions[1]).toBeGreaterThanOrEqual(100);
    expect(completions[2]).toBeGreaterThanOrEqual(200);
  });

  it('caps concurrency', async () => {
    const limiter = new RateLimiter({ ratePerSecond: 1000, burst: 1000, concurrency: 2 });
    let active = 0;
    let peak = 0;
    const release: (() => void)[] = [];

    const task = () =>
      limiter.run(
        () =>
          new Promise<void>((resolve) => {
            active += 1;
            peak = Math.max(peak, active);
            release.push(() => {
              active -= 1;
              resolve();
            });
          }),
      );

    const ps = [task(), task(), task(), task()];
    await vi.advanceTimersByTimeAsync(5);
    expect(peak).toBe(2); // only 2 in flight at once

    // Release all in waves.
    while (release.length > 0) {
      release.shift()!();
      await vi.advanceTimersByTimeAsync(5);
    }
    await Promise.all(ps);
    expect(peak).toBe(2);
  });
});

describe('fetchJson retry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries on 429 honoring Retry-After then succeeds', async () => {
    const calls: number[] = [];
    const fetchImpl = vi.fn(async () => {
      calls.push(Date.now());
      if (calls.length === 1) {
        return {
          status: 429,
          headers: { get: (h: string) => (h === 'retry-after' ? '2' : null) },
          json: async () => ({}),
        } as unknown as Response;
      }
      return {
        status: 200,
        headers: { get: () => null },
        json: async () => ({ ok: true }),
      } as unknown as Response;
    });

    const promise = fetchJson<{ ok: boolean }>(
      'https://example/x',
      { method: 'GET' },
      { fetchImpl, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // first 429

    await vi.advanceTimersByTimeAsync(2000); // honor Retry-After: 2s
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries on transient 5xx', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n < 3) {
        return { status: 503, headers: { get: () => null }, json: async () => ({}) } as unknown as Response;
      }
      return { status: 200, headers: { get: () => null }, json: async () => ({ v: 1 }) } as unknown as Response;
    });

    const promise = fetchJson<{ v: number }>(
      'https://example/y',
      { method: 'GET' },
      { fetchImpl, baseDelayMs: 10, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(await promise).toEqual({ v: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
