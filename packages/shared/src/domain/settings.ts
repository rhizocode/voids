import { z } from 'zod';
import { scheduleConfigSchema } from '../enums/schedule';
import { movieStatusIdSchema } from '../enums/movie-status';

/**
 * Authentication mode. `none` for trusted LANs (default); `basic` enables a
 * single username + bcrypt-hashed password (the hash is server-internal and
 * never part of this API-facing schema).
 */
export const authModeSchema = z.enum(['none', 'basic']);
export type AuthMode = z.infer<typeof authModeSchema>;

export const minimumAvailabilitySchema = z.enum(['announced', 'inCinemas', 'released', 'tba']);
export type MinimumAvailability = z.infer<typeof minimumAvailabilitySchema>;

/**
 * Radarr (v3) connection + add-movie defaults. Stored as a single JSON column
 * on the settings row. `apiKey` is part of the single-user config and is
 * returned by the API like the TMDB key / Plex token (matching prior phases),
 * but is never written to logs.
 */
export const radarrConfigSchema = z.object({
  url: z.string().min(1),
  apiKey: z.string().min(1),
  qualityProfileId: z.number().int().nullable().default(null),
  rootFolderPath: z.string().nullable().default(null),
  monitored: z.boolean().default(true),
  minimumAvailability: minimumAvailabilitySchema.default('released'),
  /** Whether to trigger an automatic search when a movie is added. */
  searchOnAdd: z.boolean().default(true),
});
export type RadarrConfig = z.infer<typeof radarrConfigSchema>;

/**
 * The API-facing application settings (was `PlexProperties`). The password
 * hash is intentionally omitted — it lives only in the DB row.
 */
export const settingsSchema = z.object({
  tmdbApiKey: z.string().nullable(),
  schedule: scheduleConfigSchema,
  movieStatus: movieStatusIdSchema,
  connectTimeoutMs: z.number().int().positive(),
  readTimeoutMs: z.number().int().positive(),
  authMode: authModeSchema,
  autoPushRadarr: z.boolean(),
  /** RSS feeds also carry unreviewed (`new`) gaps, not just approved ones. */
  rssIncludeNew: z.boolean(),
  /** Radarr connection + defaults; null when Radarr is not configured. */
  radarr: radarrConfigSchema.nullable(),
});
export type Settings = z.infer<typeof settingsSchema>;
