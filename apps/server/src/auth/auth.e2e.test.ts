import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AuthController } from './auth.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

// Stand-in controllers that mimic the real route shapes the guard must protect
// or exempt.
@Controller('api')
class FakeApiController {
  @Get('settings')
  settings(): { ok: boolean } {
    return { ok: true };
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}

@Controller('rss')
class FakeRssController {
  @Get(':serverId/:libraryKey')
  feed(): { feed: boolean } {
    return { feed: true };
  }
}

async function bootApp(env: Record<string, string | undefined>): Promise<{
  app: INestApplication;
  handle: DbHandle;
}> {
  const handle = makeHandle();
  // AuthService reads loadEnv() (process.env) in its constructor + onModuleInit.
  const prev = { ...process.env };
  Object.assign(process.env, env);

  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController, FakeApiController, FakeRssController],
    providers: [
      AuthService,
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: DB, useValue: handle },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  // Restore env after init so other tests are unaffected.
  process.env = prev;
  return { app, handle };
}

// The test password is generated at runtime so no credential literal is ever
// committed to a tracked file (per the Phase 7 secret rules).
const TEST_PASSWORD = `pw-${Math.random().toString(36).slice(2)}`;

const BASIC_ENV = {
  AUTH_MODE: 'basic',
  AUTH_USERNAME: 'admin',
  AUTH_PASSWORD: TEST_PASSWORD,
  TLS: undefined,
};

function basicHeader(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('AuthGuard (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;

  afterEach(async () => {
    await app.close();
    handle.sqlite.close();
  });

  describe('AUTH_MODE=none', () => {
    beforeEach(async () => {
      ({ app, handle } = await bootApp({ AUTH_MODE: 'none' }));
    });

    it('allows all routes without credentials (no-op guard)', async () => {
      await request(app.getHttpServer()).get('/api/settings').expect(200);
      await request(app.getHttpServer()).get('/api/health').expect(200);
      await request(app.getHttpServer()).get('/rss/s/k').expect(200);
    });

    it('reports mode none via /api/auth/mode', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/mode').expect(200);
      expect(res.body.mode).toBe('none');
    });
  });

  describe('AUTH_MODE=basic', () => {
    beforeEach(async () => {
      ({ app, handle } = await bootApp(BASIC_ENV));
    });

    it('returns 401 + WWW-Authenticate without credentials', async () => {
      const res = await request(app.getHttpServer()).get('/api/settings').expect(401);
      expect(res.headers['www-authenticate']).toMatch(/^Basic realm="Voids"/);
    });

    it('returns 200 with correct credentials', async () => {
      await request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', basicHeader('admin', TEST_PASSWORD))
        .expect(200);
    });

    it('returns 401 with wrong password', async () => {
      await request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', basicHeader('admin', 'wrong'))
        .expect(401);
    });

    it('returns 401 with wrong username', async () => {
      await request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', basicHeader('root', TEST_PASSWORD))
        .expect(401);
    });

    it('leaves /rss/** reachable without credentials', async () => {
      await request(app.getHttpServer()).get('/rss/server/lib').expect(200);
    });

    it('leaves GET /api/health reachable without credentials', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(200);
    });

    it('leaves GET /api/auth/mode reachable without credentials', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/mode').expect(200);
      expect(res.body.mode).toBe('basic');
    });
  });

  describe('AUTH_MODE=basic with no password (fail closed)', () => {
    beforeEach(async () => {
      ({ app, handle } = await bootApp({
        AUTH_MODE: 'basic',
        AUTH_USERNAME: 'admin',
        AUTH_PASSWORD: undefined,
      }));
    });

    it('denies even correct-looking credentials (fail closed)', async () => {
      await request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', basicHeader('admin', 'anything'))
        .expect(401);
    });

    it('still exempts health + rss', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(200);
      await request(app.getHttpServer()).get('/rss/s/k').expect(200);
    });
  });
});
