import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { TmdbCacheService } from './tmdb-cache.service';
import type { TmdbClient, TmdbMovie, TmdbCollection } from './tmdb.client';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

const sampleMovie: TmdbMovie = {
  id: 584,
  title: '2 Fast 2 Furious',
  imdbId: 'tt0322259',
  collectionId: 9485,
  collectionTitle: 'The Fast and the Furious Collection',
  collectionBackdropPath: null,
  genres: ['Action', 'Crime'],
  status: 'Released',
  releaseDate: '2003-06-05',
  year: 2003,
  posterPath: '/p.jpg',
  backdropPath: '/b.jpg',
  overview: 'overview',
};

const sampleCollection: TmdbCollection = {
  id: 9485,
  name: 'The Fast and the Furious Collection',
  backdropPath: '/c.jpg',
  parts: [{ id: 9799, title: 'The Fast and the Furious', releaseDate: '2001-06-22', year: 2001, posterPath: '/9.jpg', backdropPath: null, overview: 'o' }],
};

describe('TmdbCacheService', () => {
  let handle: DbHandle;
  let getMovie: ReturnType<typeof vi.fn>;
  let getCollection: ReturnType<typeof vi.fn>;
  let cache: TmdbCacheService;

  beforeEach(() => {
    handle = makeHandle();
    getMovie = vi.fn().mockResolvedValue(sampleMovie);
    getCollection = vi.fn().mockResolvedValue(sampleCollection);
    const tmdb = { getMovie, getCollection } as unknown as TmdbClient;
    cache = new TmdbCacheService(handle, tmdb, { movieTtlMs: 1000, collectionTtlMs: 1000 });
  });

  afterEach(() => {
    handle.sqlite.close();
    vi.useRealTimers();
  });

  it('writes through on miss then serves from cache (1 network call)', async () => {
    const a = await cache.getMovie(584);
    const b = await cache.getMovie(584);
    expect(a.id).toBe(584);
    expect(b.collectionId).toBe(9485);
    expect(getMovie).toHaveBeenCalledTimes(1);
    expect(cache.networkCalls).toBe(1);
  });

  it('refetches once the TTL expires', async () => {
    vi.useFakeTimers();
    await cache.getMovie(584);
    expect(getMovie).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1500); // past 1000ms TTL
    await cache.getMovie(584);
    expect(getMovie).toHaveBeenCalledTimes(2);
  });

  it('caches collections too', async () => {
    await cache.getCollection(9485);
    const second = await cache.getCollection(9485);
    expect(second?.parts[0]?.id).toBe(9799);
    expect(getCollection).toHaveBeenCalledTimes(1);
  });

  it('does not cache a not-found collection (null)', async () => {
    getCollection.mockResolvedValue(null);
    expect(await cache.getCollection(99999)).toBeNull();
    expect(await cache.getCollection(99999)).toBeNull();
    expect(getCollection).toHaveBeenCalledTimes(2);
  });
});
