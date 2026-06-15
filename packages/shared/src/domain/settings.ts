import { z } from 'zod';
import { scheduleSelectionSchema } from '../enums/schedule';
import { movieStatusIdSchema } from '../enums/movie-status';

/**
 * Authentication mode. `none` for trusted LANs (default); `basic` enables a
 * single username + bcrypt-hashed password (the hash is server-internal and
 * never part of this API-facing schema).
 */
export const authModeSchema = z.enum(['none', 'basic']);
export type AuthMode = z.infer<typeof authModeSchema>;

/**
 * The API-facing application settings (was `PlexProperties`). The password
 * hash is intentionally omitted — it lives only in the DB row.
 */
export const settingsSchema = z.object({
  tmdbApiKey: z.string().nullable(),
  schedule: scheduleSelectionSchema,
  movieStatus: movieStatusIdSchema,
  connectTimeoutMs: z.number().int(),
  readTimeoutMs: z.number().int(),
  authMode: authModeSchema,
  autoPushRadarr: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;
