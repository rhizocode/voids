/**
 * Reusable token-bucket rate limiter with bounded concurrency and automatic
 * retry on HTTP 429 (honoring `Retry-After`) and transient 5xx/network errors.
 *
 * Replaces Gaps' fixed `Thread.sleep(350/700)` rate limiting (see brief §17).
 * The limiter is transport-agnostic: callers pass an async task; `fetchJson`
 * is a thin helper that adds the retry semantics for HTTP.
 */

export interface RateLimiterOptions {
  /** Sustained request rate, requests per second. Default 40. */
  ratePerSecond?: number;
  /** Bucket capacity (max burst). Default = ratePerSecond. */
  burst?: number;
  /** Max concurrent in-flight tasks. Default 8. */
  concurrency?: number;
}

type Waiter = () => void;

/**
 * A token bucket that refills continuously at `ratePerSecond`. `acquire()`
 * resolves once a token is available, spacing calls to the configured rate.
 * Combined with a concurrency semaphore.
 */
export class RateLimiter {
  private readonly ratePerSecond: number;
  private readonly capacity: number;
  private readonly maxConcurrency: number;

  private tokens: number;
  private lastRefill: number;
  private inFlight = 0;
  private readonly queue: Waiter[] = [];

  /** Injectable clock + timer for deterministic tests (fake timers). */
  private readonly now: () => number;
  private readonly setTimer: (cb: () => void, ms: number) => void;

  constructor(
    options: RateLimiterOptions = {},
    deps: {
      now?: () => number;
      setTimer?: (cb: () => void, ms: number) => void;
    } = {},
  ) {
    this.ratePerSecond = options.ratePerSecond ?? 40;
    this.capacity = options.burst ?? this.ratePerSecond;
    this.maxConcurrency = options.concurrency ?? 8;
    this.tokens = this.capacity;
    this.now = deps.now ?? (() => Date.now());
    this.lastRefill = this.now();
    this.setTimer =
      deps.setTimer ?? ((cb, ms) => void setTimeout(cb, ms));
  }

  private refill(): void {
    const t = this.now();
    const elapsed = (t - this.lastRefill) / 1000;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.ratePerSecond);
    this.lastRefill = t;
  }

  /** Wait for a token + a concurrency slot. */
  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      const attempt = (): void => {
        this.refill();
        if (this.tokens >= 1 && this.inFlight < this.maxConcurrency) {
          this.tokens -= 1;
          this.inFlight += 1;
          resolve();
          return;
        }
        // Re-arm: wait until a token would be available (or a slot frees).
        const needed = 1 - this.tokens;
        const waitMs =
          this.tokens >= 1
            ? 5 // tokens fine, blocked on concurrency — poll the queue shortly
            : Math.max(1, Math.ceil((needed / this.ratePerSecond) * 1000));
        this.queue.push(attempt);
        if (this.queue.length === 1 || this.tokens < 1) {
          this.setTimer(() => {
            // Drain everyone whose turn may have come.
            const pending = this.queue.splice(0, this.queue.length);
            for (const w of pending) w();
          }, waitMs);
        }
      };
      attempt();
    });
  }

  private release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    if (this.queue.length > 0) {
      const pending = this.queue.splice(0, this.queue.length);
      for (const w of pending) w();
    }
  }

  /** Run `task` under the limiter (one token + one concurrency slot). */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}

export interface FetchRetryOptions {
  /** Max retries on 429 / transient errors. Default 3. */
  maxRetries?: number;
  /** Fallback delay (ms) when no Retry-After is provided. Default 1000. */
  baseDelayMs?: number;
  /** Sleep implementation (overridable for tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Fetch implementation (overridable for tests). */
  fetchImpl?: typeof fetch;
  /**
   * Per-attempt timeout (ms). When set, each fetch attempt is aborted after
   * this long. Sourced from the configurable network settings so TMDB calls
   * honor the same read timeout as the media/Radarr clients. `undefined` = no
   * timeout (rely on the platform default).
   */
  timeoutMs?: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

function parseRetryAfter(value: string | null, baseDelayMs: number): number {
  if (!value) return baseDelayMs;
  const seconds = Number(value);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return baseDelayMs;
}

/**
 * GET `url` and parse JSON, retrying on 429 (honoring `Retry-After`) and on
 * transient 5xx / network errors with exponential-ish backoff. Run this inside
 * `RateLimiter.run` to also get rate limiting + concurrency.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  options: FetchRetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const sleep = options.sleep ?? defaultSleep;
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs;

  let attempt = 0;
  for (;;) {
    const controller = timeoutMs != null ? new AbortController() : undefined;
    const timer =
      controller != null ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    try {
      const res = await doFetch(
        url,
        controller != null ? { ...init, signal: controller.signal } : init,
      );
      if (res.status === 429 && attempt < maxRetries) {
        const delay = parseRetryAfter(res.headers.get('retry-after'), baseDelayMs);
        attempt += 1;
        await sleep(delay);
        continue;
      }
      if (res.status >= 500 && res.status < 600 && attempt < maxRetries) {
        attempt += 1;
        await sleep(baseDelayMs * attempt);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt += 1;
        await sleep(baseDelayMs * attempt);
        continue;
      }
      throw err;
    } finally {
      if (timer != null) clearTimeout(timer);
    }
  }
}
