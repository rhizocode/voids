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
    expect(s.rssIncludeNew).toBe(false);
    expect(s.schedule.enabled).toBe(true);
    expect(s.schedule.mode).toBe('preset');
    expect(s.schedule.presetId).toBe(2);
    expect(s.schedule.cron).toBe('0 0 4 * * MON');
    expect(s.connectTimeoutMs).toBeGreaterThan(0);
  });

  it('persists a partial update', () => {
    service.update({ movieStatus: 0, autoPushRadarr: true, rssIncludeNew: true });
    const s = service.get();
    expect(s.movieStatus).toBe(0);
    expect(s.autoPushRadarr).toBe(true);
    expect(s.rssIncludeNew).toBe(true);
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

  it('rejects a schedule with an unknown preset id', () => {
    expect(() =>
      service.update({
        schedule: { enabled: true, mode: 'preset', presetId: 999, cron: '0 0 4 * * ?' },
      }),
    ).toThrow();
  });

  it('rejects a custom schedule with an invalid cron string', () => {
    expect(() =>
      service.update({
        schedule: { enabled: true, mode: 'custom', presetId: null, cron: 'not a cron' },
      }),
    ).toThrow();
  });

  it('stores the tmdb api key without exposing a password hash', () => {
    service.setTmdbApiKey('abc123');
    const s = service.get();
    expect(s.tmdbApiKey).toBe('abc123');
    expect(s).not.toHaveProperty('authPasswordHash');
  });

  it('persists a radarr config with non-empty url and apiKey', () => {
    service.update({
      radarr: {
        url: 'http://radarr.example.com:7878',
        apiKey: 'abc123',
        qualityProfileId: null,
        rootFolderPath: null,
        monitored: true,
        minimumAvailability: 'released',
        searchOnAdd: true,
      },
    });
    const s = service.get();
    expect(s.radarr?.url).toBe('http://radarr.example.com:7878');
  });

  it('allows autoPushRadarr=false with radarr=null (Radarr not configured)', () => {
    service.update({ autoPushRadarr: false, radarr: null });
    const s = service.get();
    expect(s.autoPushRadarr).toBe(false);
    expect(s.radarr).toBeNull();
  });
});
