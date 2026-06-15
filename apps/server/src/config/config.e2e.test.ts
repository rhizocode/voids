import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { TmdbClient } from '../tmdb/tmdb.client';
import { MediaSourceRegistry } from '../media/media-source.registry';
import type { MediaSource } from '../media/media-source.interface';
import { SettingsService } from './settings.service';
import { ServersService } from './servers.service';
import { ServerRepository } from '../db/repositories/server.repository';
import { SettingsController } from './settings.controller';
import { TmdbController } from './tmdb.controller';
import { ServersController } from './servers.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

// A fake Jellyfin-shaped source returning deterministic info + libraries.
const fakeSource: MediaSource = {
  type: 'jellyfin',
  testConnection: vi.fn().mockResolvedValue({
    id: 'server-abc',
    name: 'Test Jellyfin',
    version: '10.11.0',
  }),
  listLibraries: vi.fn().mockResolvedValue([
    {
      serverId: '',
      key: 'lib-movies',
      title: 'Movies',
      type: 'movie',
      collectionType: 'movies',
      enabled: false,
      isDefault: false,
    },
  ]),
  listMovies: vi.fn().mockResolvedValue([]),
};

const fakeRegistry = { get: vi.fn().mockReturnValue(fakeSource) };
const fakeTmdb = { validateKey: vi.fn() };

describe('Config endpoints (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;

  beforeEach(async () => {
    handle = makeHandle();
    fakeTmdb.validateKey.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [SettingsController, TmdbController, ServersController],
      providers: [
        SettingsService,
        ServersService,
        ServerRepository,
        { provide: DB, useValue: handle },
        { provide: MediaSourceRegistry, useValue: fakeRegistry },
        { provide: TmdbClient, useValue: fakeTmdb },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    handle.sqlite.close();
  });

  it('GET /api/settings seeds and returns defaults', async () => {
    const res = await request(app.getHttpServer()).get('/api/settings').expect(200);
    expect(res.body.movieStatus).toBe(1);
    expect(res.body.authMode).toBe('none');
    expect(res.body).not.toHaveProperty('authPasswordHash');
  });

  it('PUT /api/settings applies a partial update', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/settings')
      .send({ autoPushRadarr: true, movieStatus: 0 })
      .expect(200);
    expect(res.body.autoPushRadarr).toBe(true);
    expect(res.body.movieStatus).toBe(0);
  });

  it('PUT /api/settings rejects an invalid body', async () => {
    await request(app.getHttpServer())
      .put('/api/settings')
      .send({ movieStatus: 5 })
      .expect(400);
  });

  it('PUT /api/tmdb/test returns TMDB_KEY_VALID(20) on a valid key', async () => {
    fakeTmdb.validateKey.mockResolvedValue(true);
    const res = await request(app.getHttpServer())
      .put('/api/tmdb/test')
      .send({ apiKey: 'good' })
      .expect(200);
    expect(res.body.code).toBe(20);
  });

  it('PUT /api/tmdb/test returns TMDB_KEY_INVALID(21) on a bad key', async () => {
    fakeTmdb.validateKey.mockResolvedValue(false);
    const res = await request(app.getHttpServer())
      .put('/api/tmdb/test')
      .send({ apiKey: 'bad' })
      .expect(200);
    expect(res.body.code).toBe(21);
  });

  it('POST /api/tmdb/key saves and returns code 23, persisted in settings', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/tmdb/key')
      .send({ apiKey: 'mykey' })
      .expect(201);
    expect(res.body.code).toBe(23);
    const settings = await request(app.getHttpServer()).get('/api/settings').expect(200);
    expect(settings.body.tmdbApiKey).toBe('mykey');
  });

  it('full server lifecycle: add -> list -> toggle library -> delete', async () => {
    // Add
    const add = await request(app.getHttpServer())
      .post('/api/servers')
      .send({ type: 'jellyfin', address: 'jellyfin.local', port: 8096, useHttps: false, token: 'secret' })
      .expect(201);
    expect(add.body.id).toBe('server-abc');
    expect(add.body).not.toHaveProperty('token');
    expect(add.body.libraries).toHaveLength(1);
    expect(add.body.libraries[0].key).toBe('lib-movies');

    // List (token stripped)
    const list = await request(app.getHttpServer()).get('/api/servers').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty('token');
    expect(list.body[0].libraries[0].enabled).toBe(false);

    // Toggle library
    const toggle = await request(app.getHttpServer())
      .put('/api/servers/server-abc/libraries/lib-movies')
      .send({ enabled: true, isDefault: true })
      .expect(200);
    expect(toggle.body.enabled).toBe(true);
    expect(toggle.body.isDefault).toBe(true);

    // GET /api/libraries reflects the flag
    const libs = await request(app.getHttpServer()).get('/api/libraries').expect(200);
    expect(libs.body[0].enabled).toBe(true);

    // Re-add preserves the enabled/isDefault flags
    const readd = await request(app.getHttpServer())
      .post('/api/servers')
      .send({ type: 'jellyfin', address: 'jellyfin.local', port: 8096, useHttps: false, token: 'secret' })
      .expect(201);
    expect(readd.body.libraries[0].enabled).toBe(true);
    expect(readd.body.libraries[0].isDefault).toBe(true);

    // Delete
    await request(app.getHttpServer()).delete('/api/servers/server-abc').expect(204);
    const empty = await request(app.getHttpServer()).get('/api/servers').expect(200);
    expect(empty.body).toHaveLength(0);
  });

  it('POST /api/servers returns 400 with connection-failed payload when test fails', async () => {
    (fakeSource.testConnection as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection refused'),
    );
    const res = await request(app.getHttpServer())
      .post('/api/servers')
      .send({ type: 'jellyfin', address: 'bad', port: 1, useHttps: false, token: 't' })
      .expect(400);
    expect(res.body.code).toBe(11);
    expect(res.body.reason).toContain('connection refused');
  });

  it('PUT /api/servers/:id/test returns success for a stored server', async () => {
    await request(app.getHttpServer())
      .post('/api/servers')
      .send({ type: 'jellyfin', address: 'jellyfin.local', port: 8096, useHttps: false, token: 'secret' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .put('/api/servers/server-abc/test')
      .expect(200);
    expect(res.body.code).toBe(10);
  });
});
