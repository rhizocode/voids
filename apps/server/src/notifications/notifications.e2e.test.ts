import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import { NotificationProviderId } from '@voids/shared';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { NotificationRepository } from '../db/repositories/notification.repository';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_PROVIDERS } from './notification.tokens';
import type { NotificationProvider } from './providers';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

// A stub Slack provider whose send() we control for the test path.
const slackSend = vi.fn();
const slackProvider: NotificationProvider = {
  id: NotificationProviderId.SLACK,
  name: 'Slack',
  configSchema: {} as never,
  isEnabled: () => true,
  send: slackSend,
};

describe('Notification endpoints (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;

  beforeEach(async () => {
    handle = makeHandle();
    slackSend.mockReset().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationService,
        NotificationRepository,
        { provide: DB, useValue: handle },
        { provide: NOTIFICATION_PROVIDERS, useValue: [slackProvider] },
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

  it('GET /api/notifications seeds and returns all 7 providers', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(7);
    expect(res.body.map((p: { id: number }) => p.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(res.body[0].enabled).toBe(false);
    expect(res.body[0].notificationTypes).toContain('GAPS_MISSING_COLLECTIONS');
  });

  it('GET /api/notifications/:provider returns one config', async () => {
    const res = await request(app.getHttpServer()).get('/api/notifications/2').expect(200);
    expect(res.body.id).toBe(2);
    expect(res.body.name).toBe('Slack');
    expect(res.body.config.id).toBe(2);
  });

  it('GET /api/notifications/:provider rejects out-of-range id', async () => {
    await request(app.getHttpServer()).get('/api/notifications/9').expect(404);
  });

  it('PUT /api/notifications/:provider validates + persists', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/notifications/2')
      .send({
        enabled: true,
        config: { id: 2, webHookUrl: 'https://hooks.slack.com/services/T/B/C' },
        notificationTypes: ['TEST', 'GAPS_MISSING_COLLECTIONS'],
      })
      .expect(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.config.webHookUrl).toBe('https://hooks.slack.com/services/T/B/C');

    const get = await request(app.getHttpServer()).get('/api/notifications/2').expect(200);
    expect(get.body.enabled).toBe(true);
    expect(get.body.notificationTypes).toEqual(['TEST', 'GAPS_MISSING_COLLECTIONS']);
  });

  it('PUT rejects a config whose id mismatches the path', async () => {
    await request(app.getHttpServer())
      .put('/api/notifications/2')
      .send({
        enabled: true,
        config: { id: 6, webHookUrl: 'https://x' },
        notificationTypes: [],
      })
      .expect(400);
  });

  it('PUT rejects a structurally invalid config', async () => {
    await request(app.getHttpServer())
      .put('/api/notifications/2')
      .send({ enabled: true, config: { id: 99 }, notificationTypes: [] })
      .expect(400);
  });

  it('PUT .../test returns 70 when the provider send succeeds', async () => {
    await request(app.getHttpServer())
      .put('/api/notifications/2')
      .send({
        enabled: true,
        config: { id: 2, webHookUrl: 'https://hooks.slack.com/services/T/B/C' },
        notificationTypes: [],
      })
      .expect(200);

    const res = await request(app.getHttpServer()).put('/api/notifications/2/test').expect(200);
    expect(res.body.code).toBe(70);
    expect(slackSend).toHaveBeenCalledOnce();
  });

  it('PUT .../test returns 71 cleanly when the provider send fails', async () => {
    slackSend.mockRejectedValueOnce(new Error('bad webhook'));
    const res = await request(app.getHttpServer()).put('/api/notifications/2/test').expect(200);
    expect(res.body.code).toBe(71);
    expect(res.body.reason).toContain('bad webhook');
  });

  it('PUT .../test on a provider with no implementation returns 71 (no crash)', async () => {
    // Gotify (id 3) has no registered implementation in this test module.
    const res = await request(app.getHttpServer()).put('/api/notifications/3/test').expect(200);
    expect(res.body.code).toBe(71);
  });

  it('PUT /api/notifications/test-all returns one result per ENABLED provider', async () => {
    await request(app.getHttpServer())
      .put('/api/notifications/2')
      .send({
        enabled: true,
        config: { id: 2, webHookUrl: 'https://hooks.slack.com/services/T/B/C' },
        notificationTypes: [],
      })
      .expect(200);

    const res = await request(app.getHttpServer()).put('/api/notifications/test-all').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(2);
    expect(res.body[0].code).toBe(70);
  });
});
