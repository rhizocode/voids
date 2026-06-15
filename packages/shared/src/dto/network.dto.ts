import { z } from 'zod';

/**
 * Network timeout settings, surfaced by `GET /api/network` and updated by
 * `PUT /api/network`. These feed the media / TMDB / Radarr HTTP clients.
 *
 * Bounds are generous (large Plex/Jellyfin libraries can be slow) but prevent
 * nonsensical values: a 1ms timeout or a multi-hour hang.
 */
export const networkSettingsSchema = z.object({
  connectTimeoutMs: z.number().int().min(100).max(600000),
  readTimeoutMs: z.number().int().min(100).max(600000),
});
export type NetworkSettings = z.infer<typeof networkSettingsSchema>;

/** Body for `PUT /api/network`. Both fields are required. */
export const updateNetworkRequestSchema = networkSettingsSchema;
export type UpdateNetworkRequest = z.infer<typeof updateNetworkRequestSchema>;
