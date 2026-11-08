import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Movie } from '@voids/shared';
import { schema } from '../schema';
import type { DbHandle } from '../client';
import { MovieRepository } from './movie.repository';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', '..', 'drizzle') });
  return { db, sqlite };
}

const SERVER = 'srv-1';
const LIB = 'lib-1';

function makeRepo(): MovieRepository {
  const handle = makeHandle();
  return new MovieRepository(handle);
}

const baseMovie = (overrides: Partial<Movie> = {}): Movie => ({
  title: 'Some Film',
  year: 2020,
  tmdbId: null,
  imdbId: null,
  collectionId: null,
  collectionTitle: null,
  posterUrl: null,
  backdropUrl: null,
  language: 'en',
  overview: null,
  genres: [],
  moviesInCollection: [],
  mediaItemId: null,
  mediaItemKey: null,
  ...overrides,
});

describe('MovieRepository.feedCounts', () => {
  it('counts only approved gaps unless new ones are included', () => {
    const repo = makeRepo();
    repo.upsertRecommended(SERVER, 'lib-a', baseMovie({ tmdbId: 1 }));
    repo.upsertRecommended(SERVER, 'lib-a', baseMovie({ tmdbId: 2 }));
    const [row1] = repo.listRecommended(SERVER, 'lib-a');
    repo.updateRecommendedStatus(row1.id, 'approved');
    expect(repo.feedCounts(false)).toEqual([{ serverId: SERVER, libraryKey: 'lib-a', count: 1 }]);
    expect(repo.feedCounts(true)).toEqual([{ serverId: SERVER, libraryKey: 'lib-a', count: 2 }]);
  });

  it('returns per-library counts excluding rejected and ignored', () => {
    const repo = makeRepo();
    repo.upsertRecommended(SERVER, 'lib-a', baseMovie({ tmdbId: 1 }));
    repo.upsertRecommended(SERVER, 'lib-a', baseMovie({ tmdbId: 2 }));
    repo.upsertRecommended(SERVER, 'lib-b', baseMovie({ tmdbId: 3 }));
    const [row1] = repo.listRecommended(SERVER, 'lib-a');
    repo.updateRecommendedStatus(row1.id, 'rejected');
    const counts = repo.feedCounts(true);
    const a = counts.find((r) => r.libraryKey === 'lib-a');
    const b = counts.find((r) => r.libraryKey === 'lib-b');
    expect(a?.count).toBe(1);
    expect(b?.count).toBe(1);
    expect(counts.every((r) => typeof r.count === 'number')).toBe(true);
  });
});

describe('MovieRepository.upsertRecommended', () => {
  describe('idempotency for tmdbId-less recommendations', () => {
    it('does not create a duplicate row when the same imdbId-only recommendation is upserted twice', () => {
      const repo = makeRepo();
      const movie = baseMovie({ imdbId: 'tt1234567' });
      repo.upsertRecommended(SERVER, LIB, movie);
      repo.upsertRecommended(SERVER, LIB, movie);
      expect(repo.listRecommended(SERVER, LIB)).toHaveLength(1);
    });

    it('does not create a duplicate row when the same title+year recommendation is upserted twice', () => {
      const repo = makeRepo();
      const movie = baseMovie({ title: 'Unique Title', year: 2019 });
      repo.upsertRecommended(SERVER, LIB, movie);
      repo.upsertRecommended(SERVER, LIB, movie);
      expect(repo.listRecommended(SERVER, LIB)).toHaveLength(1);
    });

    it('preserves status across re-runs for imdbId-keyed recommendation', () => {
      const repo = makeRepo();
      const movie = baseMovie({ imdbId: 'tt9999999' });
      repo.upsertRecommended(SERVER, LIB, movie);
      const [first] = repo.listRecommended(SERVER, LIB);
      repo.updateRecommendedStatus(first.id, 'approved');
      repo.upsertRecommended(SERVER, LIB, movie);
      const rows = repo.listRecommended(SERVER, LIB);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('approved');
    });

    it('preserves status across re-runs for title+year-keyed recommendation', () => {
      const repo = makeRepo();
      const movie = baseMovie({ title: 'No Id Film', year: 2021 });
      repo.upsertRecommended(SERVER, LIB, movie);
      const [first] = repo.listRecommended(SERVER, LIB);
      repo.updateRecommendedStatus(first.id, 'rejected');
      repo.upsertRecommended(SERVER, LIB, movie);
      const rows = repo.listRecommended(SERVER, LIB);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('rejected');
    });
  });
});
