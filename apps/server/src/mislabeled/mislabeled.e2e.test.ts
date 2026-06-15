import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import type { Movie } from '@voids/shared';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { MovieRepository } from '../db/repositories/movie.repository';
import { TmdbCacheService } from '../tmdb/tmdb-cache.service';
import { MislabeledService } from './mislabeled.service';
import { MislabeledController } from './mislabeled.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

function owned(title: string, tmdbId: number | null, year: number): Movie {
  return {
    title,
    year,
    tmdbId,
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
  };
}

const TMDB_TITLES: Record<number, string> = {
  603: 'The Matrix',
  24428: 'The Avengers',
};

describe('Mislabeled endpoint (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;

  beforeEach(async () => {
    handle = makeHandle();
    const movies = new MovieRepository(handle);
    movies.replaceOwned('srv', 'lib', [
      owned('The Matrix', 603, 1999), // matches -> not flagged
      owned('Avengers', 24428, 2012), // vs "The Avengers" distance 4 -> flagged > 3
      owned('Local Only Film', null, 2020), // no tmdbId -> skipped
    ]);

    const fakeTmdb = {
      getMovie: vi.fn(async (id: number) => ({ id, title: TMDB_TITLES[id] ?? '' })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MislabeledController],
      providers: [
        MislabeledService,
        MovieRepository,
        { provide: DB, useValue: handle },
        { provide: TmdbCacheService, useValue: fakeTmdb },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    handle.sqlite.close();
    vi.clearAllMocks();
  });

  it('flags items over the threshold', async () => {
    const res = await request(app.getHttpServer()).get('/api/mislabeled/srv/lib/3').expect(200);
    expect(res.body).toEqual([
      { ownedTitle: 'Avengers', tmdbTitle: 'The Avengers', year: 2012, tmdbId: 24428, distance: 4 },
    ]);
  });

  it('a higher threshold flags fewer items', async () => {
    const res = await request(app.getHttpServer()).get('/api/mislabeled/srv/lib/4').expect(200);
    expect(res.body).toEqual([]);
  });

  it('rejects a non-numeric threshold', async () => {
    await request(app.getHttpServer()).get('/api/mislabeled/srv/lib/abc').expect(400);
  });
});
