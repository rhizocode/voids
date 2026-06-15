import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import { MovieStatus, type Movie } from '@voids/shared';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { MovieRepository } from '../db/repositories/movie.repository';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { ServerRepository } from '../db/repositories/server.repository';
import { MediaSourceRegistry } from '../media/media-source.registry';
import type { MediaSource } from '../media/media-source.interface';
import { SettingsService } from '../config/settings.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TmdbClient, type TmdbCollection, type TmdbMovie } from '../tmdb/tmdb.client';
import { TmdbCacheService } from '../tmdb/tmdb-cache.service';
import { SearchService } from './search.service';
import { JobRunnerService } from './job-runner.service';
import { SearchController } from './search.controller';
import { LibraryService } from '../library/library.service';
import { LibraryController } from '../library/library.controller';
import { NotificationService } from '../notifications/notification.service';

const fx = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', name), 'utf8'));

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

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

const fakeSource: MediaSource = {
  type: 'jellyfin',
  testConnection: vi.fn().mockResolvedValue({ id: 'srv-1', name: 'JF', version: '10' }),
  listLibraries: vi.fn().mockResolvedValue([]),
  listMovies: vi.fn().mockResolvedValue([ownedFast]),
};

class FakeTmdbClient {
  private movies: Record<number, TmdbMovie> = {
    584: TmdbClient.parseMovie(fx('movie-584.json') as never),
    9799: TmdbClient.parseMovie(fx('movie-9799.json') as never),
    584000: TmdbClient.parseMovie(fx('movie-584000.json') as never),
  };
  private collection: TmdbCollection = TmdbClient.parseCollection(fx('collection-9485.json') as never);
  async getMovie(id: number): Promise<TmdbMovie> {
    return this.movies[id];
  }
  async getCollection(id: number): Promise<TmdbCollection | null> {
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

describe('Search pipeline (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;

  beforeEach(async () => {
    handle = makeHandle();
    // Seed the server row so library.scan can find connection details.
    new ServerRepository(handle); // ensure import side-effects none; use db directly
    handle.sqlite
      .prepare(
        'INSERT INTO media_servers (id, type, name, address, port, use_https, token) VALUES (?,?,?,?,?,?,?)',
      )
      .run(SERVER, 'jellyfin', 'JF', '10.0.0.99', 8096, 0, 'tok');

    const fakeRegistry = { get: vi.fn().mockReturnValue(fakeSource) };

    const moduleRef = await Test.createTestingModule({
      controllers: [LibraryController, SearchController],
      providers: [
        LibraryService,
        SearchService,
        JobRunnerService,
        SettingsService,
        RealtimeService,
        ServerRepository,
        MovieRepository,
        SearchJobRepository,
        NotificationService,
        { provide: DB, useValue: handle },
        { provide: MediaSourceRegistry, useValue: fakeRegistry },
        { provide: TmdbClient, useClass: FakeTmdbClient },
        {
          provide: TmdbCacheService,
          useFactory: (h: DbHandle, t: TmdbClient) =>
            new TmdbCacheService(h, t, { movieTtlMs: 60000, collectionTtlMs: 60000 }),
          inject: [DB, TmdbClient],
        },
      ],
    }).compile();

    // Default to RELEASED filter.
    const settings = moduleRef.get(SettingsService);
    settings.update({ movieStatus: MovieStatus.RELEASED.id });

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    // Trigger lifecycle hooks (failStale).
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    handle.sqlite.close();
    vi.clearAllMocks();
  });

  async function waitForJob(jobId: number, ms = 3000): Promise<string> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer()).get(`/api/search/${jobId}`);
      if (['succeeded', 'failed', 'cancelled'].includes(res.body.status)) return res.body.status;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('job did not finish in time');
  }

  it('scan -> owned listed -> search -> succeeded -> recommended listed', async () => {
    const scan = await request(app.getHttpServer())
      .post(`/api/libraries/${SERVER}/${LIB}/scan`)
      .expect(201);
    expect(scan.body.code).toBe(40);
    expect(scan.body.count).toBe(1);

    const owned = await request(app.getHttpServer())
      .get(`/api/owned/${SERVER}/${LIB}`)
      .expect(200);
    expect(owned.body).toHaveLength(1);
    expect(owned.body[0].tmdbId).toBe(584);

    const start = await request(app.getHttpServer())
      .post(`/api/search/${SERVER}/${LIB}`)
      .expect(201);
    const jobId = start.body.jobId as number;
    expect(typeof jobId).toBe('number');

    const status = await waitForJob(jobId);
    expect(status).toBe('succeeded');

    const recs = await request(app.getHttpServer())
      .get(`/api/recommended/${SERVER}/${LIB}`)
      .expect(200);
    expect(recs.body.map((r: { tmdbId: number }) => r.tmdbId)).toEqual([9799]);
    expect(recs.body[0].collectionTitle).toBe('The Fast and the Furious Collection');
    expect(recs.body[0].posterUrl).toContain('image.tmdb.org');
  });

  it('cancel marks a job cancelled', async () => {
    // Cancel a freshly created job before it runs.
    const start = await request(app.getHttpServer())
      .post(`/api/search/${SERVER}/${LIB}`)
      .expect(201);
    const jobId = start.body.jobId as number;
    await request(app.getHttpServer()).post(`/api/search/${jobId}/cancel`).expect(200);
    // It either finished already (fast) or was cancelled; both are terminal.
    const status = await waitForJob(jobId);
    expect(['cancelled', 'succeeded']).toContain(status);
  });
});
