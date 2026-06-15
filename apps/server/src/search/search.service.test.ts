import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { MovieStatus, type Movie } from '@voids/shared';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { MovieRepository } from '../db/repositories/movie.repository';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { RealtimeService } from '../realtime/realtime.service';
import { SearchService } from './search.service';
import { TmdbClient, type TmdbMovie, type TmdbCollection } from '../tmdb/tmdb.client';
import { TmdbCacheService } from '../tmdb/tmdb-cache.service';

const fx = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8'));

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

/** A fixture-backed TmdbClient that counts network fetches. */
class FakeTmdbClient {
  movieCalls = 0;
  collectionCalls = 0;
  private readonly movies: Record<number, TmdbMovie>;
  private readonly collection: TmdbCollection;

  constructor() {
    this.movies = {
      584: TmdbClient.parseMovie(fx('movie-584.json') as never),
      9799: TmdbClient.parseMovie(fx('movie-9799.json') as never),
      584000: TmdbClient.parseMovie(fx('movie-584000.json') as never),
    };
    this.collection = TmdbClient.parseCollection(fx('collection-9485.json') as never);
  }

  async getMovie(id: number): Promise<TmdbMovie> {
    this.movieCalls += 1;
    const m = this.movies[id];
    if (!m) throw new Error(`no fixture for movie ${id}`);
    return m;
  }

  async getCollection(id: number): Promise<TmdbCollection | null> {
    this.collectionCalls += 1;
    return id === 9485 ? this.collection : null;
  }

  async searchMovie(): Promise<number | null> {
    return null;
  }
  async findByImdb(): Promise<number | null> {
    return null;
  }
}

const SERVER = 'srv-1';
const LIB = 'lib-1';

// "2 Fast 2 Furious" — owned, with tmdbId + collectionId already populated
// (as Jellyfin would). The collection has The Fast and the Furious (9799),
// 2 Fast 2 Furious (584, owned), and an unreleased part (584000).
const ownedFast: Movie = {
  title: '2 Fast 2 Furious',
  year: 2003,
  tmdbId: 584,
  imdbId: 'tt0322259',
  collectionId: 9485,
  collectionTitle: 'The Fast and the Furious Collection',
  posterUrl: null,
  backdropUrl: null,
  language: 'en',
  overview: null,
  genres: ['Action'],
  moviesInCollection: [],
  mediaItemId: 'jf-584',
  mediaItemKey: 'jf-584',
};

describe('SearchService gap engine', () => {
  let handle: DbHandle;
  let movies: MovieRepository;
  let jobs: SearchJobRepository;
  let realtime: RealtimeService;
  let fakeTmdb: FakeTmdbClient;
  let cache: TmdbCacheService;
  let settings: { get: () => { movieStatus: number } };

  function build(movieStatus: number): SearchService {
    settings = { get: () => ({ movieStatus }) };
    cache = new TmdbCacheService(handle, fakeTmdb as unknown as TmdbClient, {
      movieTtlMs: 60_000,
      collectionTtlMs: 60_000,
    });
    return new SearchService(
      movies,
      jobs,
      settings as never,
      cache,
      realtime,
      { notify: async () => {} } as never,
    );
  }

  beforeEach(() => {
    handle = makeHandle();
    movies = new MovieRepository(handle);
    jobs = new SearchJobRepository(handle);
    realtime = new RealtimeService();
    fakeTmdb = new FakeTmdbClient();
    movies.replaceOwned(SERVER, LIB, [ownedFast]);
  });

  afterEach(() => handle.sqlite.close());

  it('finds the missing released collection part (RELEASED filter)', async () => {
    const service = build(MovieStatus.RELEASED.id);
    const jobId = jobs.create(SERVER, LIB);
    await service.runSearch(SERVER, LIB, jobId);

    const job = jobs.find(jobId)!;
    expect(job.status).toBe('succeeded');
    expect(job.totalCount).toBe(1);
    expect(job.searchedCount).toBe(1);

    const recs = movies.listRecommended(SERVER, LIB);
    // 9799 is released + missing -> recommended. 584 is owned. 584000 unreleased -> filtered.
    expect(recs.map((r) => r.tmdbId)).toEqual([9799]);
    const rec = recs[0]!;
    expect(rec.title).toBe('The Fast and the Furious');
    expect(rec.collectionTitle).toBe('The Fast and the Furious Collection');
    expect(rec.posterUrl).toBe('https://image.tmdb.org/t/p/w185/9799poster.jpg');
    expect(rec.backdropUrl).toBe('https://image.tmdb.org/t/p/original/9799b.jpg');
    expect(rec.status).toBe('new');
    expect(rec.genres).toContain('Action');
  });

  it('includes the unreleased part when MovieStatus=ALL', async () => {
    const service = build(MovieStatus.ALL.id);
    const jobId = jobs.create(SERVER, LIB);
    await service.runSearch(SERVER, LIB, jobId);
    const recs = movies.listRecommended(SERVER, LIB);
    expect(recs.map((r) => r.tmdbId).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([9799, 584000]);
  });

  it('emits a progress event carrying the found movie', async () => {
    const service = build(MovieStatus.RELEASED.id);
    const progress = vi.fn();
    realtime.registerSink({ broadcast: (event, data) => progress(event, data) });
    const jobId = jobs.create(SERVER, LIB);
    await service.runSearch(SERVER, LIB, jobId);

    const withMovie = progress.mock.calls.find(
      ([event, data]) => event === 'job:progress' && (data as { movie?: unknown }).movie,
    );
    expect(withMovie).toBeTruthy();
    expect((withMovie![1] as { movie: { tmdbId: number } }).movie.tmdbId).toBe(9799);

    const finished = progress.mock.calls.find(([event]) => event === 'job:finished');
    expect((finished![1] as { payloadCode: number }).payloadCode).toBe(0);
  });

  it('is idempotent and preserves status on re-run', async () => {
    const service = build(MovieStatus.RELEASED.id);
    await service.runSearch(SERVER, LIB, jobs.create(SERVER, LIB));

    // Manually approve the recommendation.
    const recBefore = movies.listRecommended(SERVER, LIB);
    expect(recBefore).toHaveLength(1);
    handle.sqlite.prepare("UPDATE recommended_movies SET status = 'approved'").run();

    // Second run must not duplicate and must keep the approved status.
    await service.runSearch(SERVER, LIB, jobs.create(SERVER, LIB));
    const recAfter = movies.listRecommended(SERVER, LIB);
    expect(recAfter).toHaveLength(1);
    expect(recAfter[0]!.status).toBe('approved');
  });

  it('dedups owned movies sharing a movieKey within a run', async () => {
    // Add a duplicate of the owned movie (same tmdbId -> same movieKey).
    movies.replaceOwned(SERVER, LIB, [ownedFast, { ...ownedFast, mediaItemId: 'dup' }]);
    const service = build(MovieStatus.RELEASED.id);
    const jobId = jobs.create(SERVER, LIB);
    await service.runSearch(SERVER, LIB, jobId);
    // Collection fetched only once despite the duplicate owned movie.
    expect(fakeTmdb.collectionCalls).toBe(1);
    const job = jobs.find(jobId)!;
    expect(job.totalCount).toBe(2);
    expect(job.searchedCount).toBe(2);
  });

  it('continues the run when one movie TMDB lookup fails', async () => {
    // Second owned movie whose tmdbId has no fixture -> getMovie throws.
    const badMovie: Movie = {
      ...ownedFast,
      title: 'Bad Movie',
      tmdbId: 99999,
      imdbId: null,
      collectionId: null,
      mediaItemId: 'jf-99999',
      mediaItemKey: 'jf-99999',
    };
    movies.replaceOwned(SERVER, LIB, [ownedFast, badMovie]);
    const service = build(MovieStatus.RELEASED.id);
    const jobId = jobs.create(SERVER, LIB);
    await service.runSearch(SERVER, LIB, jobId);

    const job = jobs.find(jobId)!;
    // Run must succeed, not fail, despite the bad movie.
    expect(job.status).toBe('succeeded');
    expect(job.totalCount).toBe(2);
    expect(job.searchedCount).toBe(2);
    // The good movie's gap must still be recorded.
    const recs = movies.listRecommended(SERVER, LIB);
    expect(recs.map((r) => r.tmdbId)).toContain(9799);
  });

  it('warm cache: a second run makes far fewer network calls', async () => {
    const service = build(MovieStatus.RELEASED.id);
    await service.runSearch(SERVER, LIB, jobs.create(SERVER, LIB));
    const afterFirst = fakeTmdb.movieCalls + fakeTmdb.collectionCalls;
    expect(afterFirst).toBeGreaterThan(0);

    fakeTmdb.movieCalls = 0;
    fakeTmdb.collectionCalls = 0;
    await service.runSearch(SERVER, LIB, jobs.create(SERVER, LIB));
    const afterSecond = fakeTmdb.movieCalls + fakeTmdb.collectionCalls;
    expect(afterSecond).toBe(0); // fully served from cache
  });
});
