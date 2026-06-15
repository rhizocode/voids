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
    expect(s.schedule.label).toBe('Weekly');
    expect(s.connectTimeoutMs).toBeGreaterThan(0);
  });

  it('persists a partial update', () => {
    service.update({ movieStatus: 0, autoPushRadarr: true });
    const s = service.get();
    expect(s.movieStatus).toBe(0);
    expect(s.autoPushRadarr).toBe(true);
  });

  it('updates the schedule selection', () => {
    service.update({
      schedule: { id: 1, label: 'Daily', cron: '0 0 4 * * ?', enabled: true, custom: false },
    });
    expect(service.get().schedule.label).toBe('Daily');
  });

  it('stores the tmdb api key without exposing a password hash', () => {
    service.setTmdbApiKey('abc123');
    const s = service.get();
    expect(s.tmdbApiKey).toBe('abc123');
    expect(s).not.toHaveProperty('authPasswordHash');
  });
});
