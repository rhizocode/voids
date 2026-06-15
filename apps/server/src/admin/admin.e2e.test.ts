import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { schema } from '../db/schema';
import {
  collectionCache,
  libraries,
  mediaServers,
  movieCache,
  notificationProviders,
  ownedMovies,
  recommendedMovies,
  searchJobs,
  settings as settingsTable,
} from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { SettingsService } from '../config/settings.service';
import { NotificationRepository } from '../db/repositories/notification.repository';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

function seedData(handle: DbHandle): void {
  const { db } = handle;
  db.insert(settingsTable)
    .values({ id: 1, tmdbApiKey: 'leftover', movieStatus: 0, authMode: 'basic' })
    .run();
  db.insert(mediaServers)
    .values({ id: 'srv1', type: 'jellyfin', address: 'x', port: 8096 })
    .run();
  db.insert(libraries).values({ serverId: 'srv1', key: 'lib1', title: 'Movies' }).run();
  db.insert(ownedMovies).values({ serverId: 'srv1', libraryKey: 'lib1', title: 'A' }).run();
  db.insert(recommendedMovies)
    .values({ serverId: 'srv1', libraryKey: 'lib1', title: 'B' })
    .run();
  db.insert(movieCache).values({ tmdbId: 1, title: 'C' }).run();
  db.insert(collectionCache).values({ collectionId: 1, name: 'Coll' }).run();
  db.insert(notificationProviders)
    .values({ id: 0, name: 'Telegram', enabled: true, config: { foo: 'bar' } })
    .run();
  db.insert(searchJobs).values({ serverId: 'srv1', libraryKey: 'lib1' }).run();
}

describe('Admin nuke (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;

  beforeEach(async () => {
    handle = makeHandle();
    seedData(handle);

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminService,
        SettingsService,
        NotificationRepository,
        { provide: DB, useValue: handle },
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

  const nukeBody = { confirm: 'nuke' };

  it('rejects nuke without confirmation body (400)', async () => {
    await request(app.getHttpServer()).post('/api/nuke').expect(400);
  });

  it('rejects nuke with wrong confirmation value (400)', async () => {
    await request(app.getHttpServer()).post('/api/nuke').send({ confirm: 'yes' }).expect(400);
  });

  it('POST /api/nuke returns NUKE_SUCCESSFUL(30)', async () => {
    const res = await request(app.getHttpServer()).post('/api/nuke').send(nukeBody).expect(200);
    expect(res.body.code).toBe(30);
  });

  it('wipes all data tables', async () => {
    await request(app.getHttpServer()).post('/api/nuke').send(nukeBody).expect(200);
    const { db } = handle;
    expect(db.select().from(mediaServers).all()).toHaveLength(0);
    expect(db.select().from(libraries).all()).toHaveLength(0);
    expect(db.select().from(ownedMovies).all()).toHaveLength(0);
    expect(db.select().from(recommendedMovies).all()).toHaveLength(0);
    expect(db.select().from(movieCache).all()).toHaveLength(0);
    expect(db.select().from(collectionCache).all()).toHaveLength(0);
    expect(db.select().from(searchJobs).all()).toHaveLength(0);
  });

  it('re-seeds the 7 notification providers (disabled, defaults)', async () => {
    await request(app.getHttpServer()).post('/api/nuke').send(nukeBody).expect(200);
    const rows = handle.db.select().from(notificationProviders).all();
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.enabled === false)).toBe(true);
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('resets settings to defaults', async () => {
    await request(app.getHttpServer()).post('/api/nuke').send(nukeBody).expect(200);
    const row = handle.db.select().from(settingsTable).all();
    expect(row).toHaveLength(1);
    expect(row[0].tmdbApiKey).toBeNull();
    expect(row[0].movieStatus).toBe(1);
    expect(row[0].authMode).toBe('none');
  });
});
