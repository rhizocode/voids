import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { SettingsService } from './settings.service';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

describe('SettingsService', () => {
  let handle: DbHandle;
  let service: SettingsService;

  beforeEach(() => {
    handle = makeHandle();
    service = new SettingsService(handle);
  });

  afterEach(() => {
    handle.sqlite.close();
  });

  it('seeds defaults on first read', () => {
    const s = service.get();
    expect(s.tmdbApiKey).toBeNull();
    expect(s.movieStatus).toBe(1);
    expect(s.authMode).toBe('none');
    expect(s.autoPushRadarr).toBe(false);
    expect(s.schedule.enabled).toBe(true);
    expect(s.schedule.mode).toBe('preset');
    expect(s.schedule.presetId).toBe(2);
    expect(s.schedule.cron).toBe('0 0 4 * * MON');
    expect(s.connectTimeoutMs).toBeGreaterThan(0);
  });

  it('persists a partial update', () => {
    service.update({ movieStatus: 0, autoPushRadarr: true });
    const s = service.get();
    expect(s.movieStatus).toBe(0);
    expect(s.autoPushRadarr).toBe(true);
  });

  it('updates the schedule config', () => {
    service.update({
      schedule: { enabled: true, mode: 'preset', presetId: 1, cron: '0 0 4 * * ?' },
    });
    const s = service.get();
    expect(s.schedule.mode).toBe('preset');
    expect(s.schedule.presetId).toBe(1);
    expect(s.schedule.cron).toBe('0 0 4 * * ?');
  });

  it('stores the tmdb api key without exposing a password hash', () => {
    service.setTmdbApiKey('abc123');
    const s = service.get();
    expect(s.tmdbApiKey).toBe('abc123');
    expect(s).not.toHaveProperty('authPasswordHash');
  });
});
