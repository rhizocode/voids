import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { ServerRepository } from '../db/repositories/server.repository';
import { MovieRepository } from '../db/repositories/movie.repository';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { MediaSourceRegistry } from '../media/media-source.registry';
import type { MediaSource } from '../media/media-source.interface';
import { SettingsService } from '../config/settings.service';
import { LibraryService } from '../library/library.service';
import { JobRunnerService } from '../search/job-runner.service';
import { SearchService } from '../search/search.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TmdbClient } from '../tmdb/tmdb.client';
import { TmdbCacheService } from '../tmdb/tmdb-cache.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationRepository } from '../db/repositories/notification.repository';
import { NOTIFICATION_PROVIDERS } from '../notifications/notification.tokens';
import { SchedulerService } from './scheduler.service';
import { SearchAllTask } from './search-all.task';
import { RadarrService } from '../radarr/radarr.service';
import { RadarrClient } from '../radarr/radarr.client';
import { ScheduleController } from './schedule.controller';
import { MovieStatusController } from './movie-status.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

const SERVER = 'srv-1';
const LIB = 'lib-1';

const fakeSource: MediaSource = {
  type: 'jellyfin',
  testConnection: vi.fn().mockResolvedValue({ id: SERVER, name: 'JF', version: '10' }),
  listLibraries: vi.fn().mockResolvedValue([
    {
      serverId: SERVER,
      key: LIB,
      title: 'Movies',
      type: 'movie',
      collectionType: 'movies',
      enabled: false,
      isDefault: false,
    },
  ]),
  listMovies: vi.fn().mockResolvedValue([]),
};

class FakeTmdbClient {
  async getMovie(): Promise<unknown> {
    return null;
  }
  async getCollection(): Promise<null> {
    return null;
  }
  async searchMovie(): Promise<null> {
    return null;
  }
  async findByImdb(): Promise<null> {
    return null;
  }
}

describe('Schedule + movie-status (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;
  let rescheduleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    handle = makeHandle();
    // Seed a server + an enabled+default library so /schedule/run has work.
    handle.sqlite
      .prepare(
        'INSERT INTO media_servers (id, type, name, address, port, use_https, token) VALUES (?,?,?,?,?,?,?)',
      )
      .run(SERVER, 'jellyfin', 'JF', '10.0.0.99', 8096, 0, 'tok');
    handle.sqlite
      .prepare(
        'INSERT INTO libraries (server_id, key, title, type, collection_type, enabled, is_default) VALUES (?,?,?,?,?,?,?)',
      )
      .run(SERVER, LIB, 'Movies', 'movie', 'movies', 1, 1);

    const fakeRegistry = { get: vi.fn().mockReturnValue(fakeSource) };

    const moduleRef = await Test.createTestingModule({
      controllers: [ScheduleController, MovieStatusController],
      providers: [
        SchedulerService,
        SearchAllTask,
        SettingsService,
        LibraryService,
        JobRunnerService,
        SearchService,
        RealtimeService,
        SchedulerRegistry,
        ServerRepository,
        MovieRepository,
        SearchJobRepository,
        NotificationService,
        NotificationRepository,
        RadarrService,
        { provide: RadarrClient, useValue: { listMovies: vi.fn(), addMovie: vi.fn(), testConnection: vi.fn(), getQualityProfiles: vi.fn(), getRootFolders: vi.fn() } },
        { provide: NOTIFICATION_PROVIDERS, useValue: [] },
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

    const scheduler = moduleRef.get(SchedulerService);
    rescheduleSpy = vi.spyOn(scheduler, 'reschedule');

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    handle.sqlite.close();
    vi.clearAllMocks();
  });

  it('GET /api/schedule returns the default schedule config', async () => {
    const res = await request(app.getHttpServer()).get('/api/schedule').expect(200);
    expect(res.body.mode).toBe('preset');
    expect(res.body.presetId).toBe(2);
    expect(res.body.cron).toBe('0 0 4 * * MON');
    expect(res.body.enabled).toBe(true);
  });

  it('GET /api/schedule/all returns the 5 presets', async () => {
    const res = await request(app.getHttpServer()).get('/api/schedule/all').expect(200);
    expect(res.body).toHaveLength(5);
    expect(res.body.map((p: { id: number }) => p.id)).toEqual([0, 1, 2, 3, 4]);
    expect(res.body[2].cron).toBe('0 0 4 * * MON');
  });

  it('PUT /api/schedule persists a preset and triggers reschedule', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/schedule')
      .send({ enabled: true, mode: 'preset', presetId: 1, cron: 'ignored-overwritten' })
      .expect(200);
    // Preset cron is forced to match the preset (ignores the supplied cron).
    expect(res.body.cron).toBe('0 0 4 * * ?');
    expect(res.body.presetId).toBe(1);
    expect(rescheduleSpy).toHaveBeenCalledTimes(1);

    // Persisted.
    const get = await request(app.getHttpServer()).get('/api/schedule').expect(200);
    expect(get.body.presetId).toBe(1);
  });

  it('PUT /api/schedule accepts a custom cron', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/schedule')
      .send({ enabled: true, mode: 'custom', presetId: null, cron: '0 30 2 * * ?' })
      .expect(200);
    expect(res.body.mode).toBe('custom');
    expect(res.body.cron).toBe('0 30 2 * * ?');
    expect(rescheduleSpy).toHaveBeenCalled();
  });

  it('PUT /api/schedule rejects an invalid custom cron with 400', async () => {
    await request(app.getHttpServer())
      .put('/api/schedule')
      .send({ enabled: true, mode: 'custom', presetId: null, cron: 'not a cron' })
      .expect(400);
    expect(rescheduleSpy).not.toHaveBeenCalled();
  });

  it('GET /api/movie-status returns id+label and PUT persists', async () => {
    const initial = await request(app.getHttpServer()).get('/api/movie-status').expect(200);
    expect(initial.body).toEqual({ id: 1, label: 'Released' });

    const put = await request(app.getHttpServer())
      .put('/api/movie-status')
      .send({ movieStatus: 0 })
      .expect(200);
    expect(put.body).toEqual({ id: 0, label: 'All' });

    const after = await request(app.getHttpServer()).get('/api/movie-status').expect(200);
    expect(after.body.id).toBe(0);
  });

  it('POST /api/schedule/run returns 202 and enqueues a search', async () => {
    const enqueueSpy = vi.spyOn(app.get(JobRunnerService), 'enqueue');
    const res = await request(app.getHttpServer()).post('/api/schedule/run').expect(202);
    expect(res.body).toEqual({ started: true });

    // The run is fire-and-forget; give it a tick to scan + enqueue.
    await vi.waitFor(() => {
      expect(enqueueSpy).toHaveBeenCalledWith(SERVER, LIB);
    }, 3000);
  });
});
