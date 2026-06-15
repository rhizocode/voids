import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  Schedule,
  type AuthMode,
  type MovieStatusId,
  type ScheduleConfig,
  type Settings,
} from '@voids/shared';
import { DB } from '../db/db.module';
import type { DbHandle } from '../db/client';
import { settings as settingsTable } from '../db/schema';

const SETTINGS_ID = 1;

/**
 * The default schedule config used on first read: a weekly (Monday 4am) preset,
 * registered/enabled by default so a fresh install runs headless out of the box.
 */
function defaultSchedule(): ScheduleConfig {
  return {
    enabled: true,
    mode: 'preset',
    presetId: Schedule.EVERY_MONDAY.id,
    cron: Schedule.EVERY_MONDAY.cron,
  };
}

type SettingsRow = typeof settingsTable.$inferSelect;

/** Settings storage backed by the single-row `settings` table (id=1). */
@Injectable()
export class SettingsService {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  private get db() {
    return this.handle.db;
  }

  /** Map a DB row to the API-facing Settings (never exposes the password hash). */
  private toSettings(row: SettingsRow): Settings {
    const schedule = (row.schedule as ScheduleConfig | null) ?? defaultSchedule();
    return {
      tmdbApiKey: row.tmdbApiKey,
      schedule,
      movieStatus: (row.movieStatus === 0 ? 0 : 1) as MovieStatusId,
      connectTimeoutMs: row.connectTimeoutMs,
      readTimeoutMs: row.readTimeoutMs,
      authMode: (row.authMode as AuthMode) ?? 'none',
      autoPushRadarr: row.autoPushRadarr,
    };
  }

  /** Read settings, seeding the default row on first access. */
  get(): Settings {
    const existing = this.db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, SETTINGS_ID))
      .get();
    if (existing) return this.toSettings(existing);

    this.db
      .insert(settingsTable)
      .values({ id: SETTINGS_ID, schedule: defaultSchedule(), movieStatus: 1 })
      .run();
    const seeded = this.db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, SETTINGS_ID))
      .get();
    return this.toSettings(seeded as SettingsRow);
  }

  /** Apply a partial update to the settings row and return the result. */
  update(
    partial: Partial<Omit<Settings, 'tmdbApiKey'>> & { tmdbApiKey?: string | null },
  ): Settings {
    this.get(); // ensure the row exists

    const set: Partial<typeof settingsTable.$inferInsert> = { updatedAt: new Date() };
    if (partial.tmdbApiKey !== undefined) set.tmdbApiKey = partial.tmdbApiKey;
    if (partial.schedule !== undefined) set.schedule = partial.schedule;
    if (partial.movieStatus !== undefined) set.movieStatus = partial.movieStatus;
    if (partial.connectTimeoutMs !== undefined) set.connectTimeoutMs = partial.connectTimeoutMs;
    if (partial.readTimeoutMs !== undefined) set.readTimeoutMs = partial.readTimeoutMs;
    if (partial.authMode !== undefined) set.authMode = partial.authMode;
    if (partial.autoPushRadarr !== undefined) set.autoPushRadarr = partial.autoPushRadarr;

    this.db.update(settingsTable).set(set).where(eq(settingsTable.id, SETTINGS_ID)).run();
    return this.get();
  }

  /** Convenience: persist just the TMDB API key. */
  setTmdbApiKey(apiKey: string): Settings {
    return this.update({ tmdbApiKey: apiKey });
  }
}
