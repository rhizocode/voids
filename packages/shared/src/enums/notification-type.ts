import { z } from 'zod';

/**
 * The categories of events a notification provider can subscribe to.
 * `TEST` bypasses the per-provider subscription filter.
 */
export const notificationTypeSchema = z.enum([
  'TEST',
  'TMDB_API_CONNECTION',
  'PLEX_SERVER_CONNECTION',
  'PLEX_METADATA_UPDATE',
  'PLEX_LIBRARY_UPDATE',
  'GAPS_MISSING_COLLECTIONS',
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const NotificationType = notificationTypeSchema.enum;
