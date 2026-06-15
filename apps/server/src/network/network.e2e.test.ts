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
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { SettingsService } from '../config/settings.service';
import { NetworkController } from './network.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

describe('Network settings (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;

  beforeEach(async () => {
    handle = makeHandle();
    const moduleRef = await Test.createTestingModule({
      controllers: [NetworkController],
      providers: [SettingsService, { provide: DB, useValue: handle }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    handle.sqlite.close();
  });

  it('GET /api/network returns the default timeouts', async () => {
    const res = await request(app.getHttpServer()).get('/api/network').expect(200);
    expect(res.body.connectTimeoutMs).toBe(10000);
    expect(res.body.readTimeoutMs).toBe(60000);
  });

  it('PUT /api/network persists and returns the new timeouts', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/network')
      .send({ connectTimeoutMs: 5000, readTimeoutMs: 30000 })
      .expect(200);
    expect(res.body).toEqual({ connectTimeoutMs: 5000, readTimeoutMs: 30000 });

    const after = await request(app.getHttpServer()).get('/api/network').expect(200);
    expect(after.body).toEqual({ connectTimeoutMs: 5000, readTimeoutMs: 30000 });
  });

  it('PUT /api/network rejects out-of-range / missing values', async () => {
    await request(app.getHttpServer())
      .put('/api/network')
      .send({ connectTimeoutMs: 1, readTimeoutMs: 30000 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/network')
      .send({ connectTimeoutMs: 5000 })
      .expect(400);
  });
});
