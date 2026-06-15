import { z } from 'zod';
import { settingsSchema } from '../domain/settings';

/** Response for `GET /api/settings` and `PUT /api/settings`. */
export const settingsResponseSchema = settingsSchema;
export type SettingsResponse = z.infer<typeof settingsResponseSchema>;

/**
 * Body for `PUT /api/settings` — a partial update. `tmdbApiKey` is updated via
 * the dedicated TMDB endpoints, so it is omitted here.
 */
export const updateSettingsRequestSchema = settingsSchema
  .omit({ tmdbApiKey: true })
  .partial();
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
