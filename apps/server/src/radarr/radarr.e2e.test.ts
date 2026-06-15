import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import type { RadarrConfig } from '@voids/shared';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { MovieRepository } from '../db/repositories/movie.repository';
import { SettingsService } from '../config/settings.service';
import { RadarrClient } from './radarr.client';
import { RadarrService } from './radarr.service';
import { RadarrController } from './radarr.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

const RADARR: RadarrConfig = {
  url: 'http://radarr.test:7878',
  apiKey: 'k',
  qualityProfileId: 1,
  rootFolderPath: '/movies',
  monitored: true,
  minimumAvailability: 'released',
  searchOnAdd: true,
};

describe('Radarr endpoints (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;
  let fakeClient: {
    testConnection: ReturnType<typeof vi.fn>;
    listMovies: ReturnType<typeof vi.fn>;
    getQualityProfiles: ReturnType<typeof vi.fn>;
    getRootFolders: ReturnType<typeof vi.fn>;
    addMovie: ReturnType<typeof vi.fn>;
  };

  async function boot(radarr: RadarrConfig | null) {
    handle = makeHandle();
    fakeClient = {
      testConnection: vi.fn().mockResolvedValue(undefined),
      listMovies: vi.fn().mockResolvedValue([
        { tmdbId: 603, imdbId: 'tt0133093', title: 'The Matrix', year: 1999, hasFile: true, monitored: true },
      ]),
      getQualityProfiles: vi.fn().mockResolvedValue([{ id: 1, name: 'HD-1080p' }]),
      getRootFolders: vi.fn().mockResolvedValue([{ path: '/movies', freeSpace: 100 }]),
      addMovie: vi.fn().mockResolvedValue({ status: 'added' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [RadarrController],
      providers: [
        RadarrService,
        SettingsService,
        MovieRepository,
        { provide: DB, useValue: handle },
        { provide: RadarrClient, useValue: fakeClient },
      ],
    }).compile();

    const settings = moduleRef.get(SettingsService);
    settings.update({ radarr });

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
    handle?.sqlite.close();
    vi.clearAllMocks();
  });

  describe('configured', () => {
    beforeEach(() => boot(RADARR));

    it('PUT /api/radarr/test -> success payload', async () => {
      const res = await request(app.getHttpServer()).put('/api/radarr/test').expect(200);
      expect(res.body.code).toBe(160);
      expect(fakeClient.testConnection).toHaveBeenCalledTimes(1);
    });

    it('GET /api/radarr/movies -> cross-check list', async () => {
      const res = await request(app.getHttpServer()).get('/api/radarr/movies').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].tmdbId).toBe(603);
    });

    it('GET /api/radarr/quality-profiles + root-folders', async () => {
      const p = await request(app.getHttpServer()).get('/api/radarr/quality-profiles').expect(200);
      expect(p.body).toEqual([{ id: 1, name: 'HD-1080p' }]);
      const f = await request(app.getHttpServer()).get('/api/radarr/root-folders').expect(200);
      expect(f.body[0].path).toBe('/movies');
    });

    it('POST push-radarr -> results for approved recommendations', async () => {
      const movies = app.get(MovieRepository);
      movies.upsertRecommended('srv', 'lib', {
        title: 'The Matrix Reloaded',
        year: 2003,
        tmdbId: 604,
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
      });
      const inserted = movies.listRecommended('srv', 'lib')[0];
      movies.updateRecommendedStatus(inserted.id, 'approved');

      const res = await request(app.getHttpServer())
        .post('/api/recommended/srv/lib/push-radarr')
        .expect(200);
      expect(res.body.configured).toBe(true);
      expect(res.body.results).toEqual([{ tmdbId: 604, title: 'The Matrix Reloaded', status: 'added' }]);
      expect(fakeClient.addMovie).toHaveBeenCalledTimes(1);
    });

    it('test failure -> failure payload (never throws)', async () => {
      fakeClient.testConnection.mockRejectedValueOnce(new Error('down'));
      const res = await request(app.getHttpServer()).put('/api/radarr/test').expect(200);
      expect(res.body.code).toBe(161);
    });
  });

  describe('unconfigured (graceful degradation)', () => {
    beforeEach(() => boot(null));

    it('PUT /api/radarr/test -> not configured payload', async () => {
      const res = await request(app.getHttpServer()).put('/api/radarr/test').expect(200);
      expect(res.body.code).toBe(162);
      expect(fakeClient.testConnection).not.toHaveBeenCalled();
    });

    it('movies / profiles / folders -> [] (no crash)', async () => {
      expect((await request(app.getHttpServer()).get('/api/radarr/movies').expect(200)).body).toEqual([]);
      expect((await request(app.getHttpServer()).get('/api/radarr/quality-profiles').expect(200)).body).toEqual([]);
      expect((await request(app.getHttpServer()).get('/api/radarr/root-folders').expect(200)).body).toEqual([]);
    });

    it('push-radarr -> configured:false with empty results', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/recommended/srv/lib/push-radarr')
        .expect(200);
      expect(res.body).toEqual({ configured: false, results: [] });
    });
  });
});
