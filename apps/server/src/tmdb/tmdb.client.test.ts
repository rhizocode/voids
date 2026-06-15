import { describe, it, expect, vi, afterEach } from 'vitest';
import { TmdbClient } from './tmdb.client';

describe('TmdbClient.validateKey', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true on 200 + { success: true }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }),
    );
    expect(await new TmdbClient().validateKey('good')).toBe(true);
  });

  it('returns false on 200 + { success: false }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }),
    );
    expect(await new TmdbClient().validateKey('bad')).toBe(false);
  });

  it('returns false on a non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    expect(await new TmdbClient().validateKey('bad')).toBe(false);
  });

  it('returns false (never throws) on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await new TmdbClient().validateKey('x')).toBe(false);
  });

  it('returns false when the fetch is aborted due to timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')));
    expect(await new TmdbClient().validateKey('x')).toBe(false);
  });
});
