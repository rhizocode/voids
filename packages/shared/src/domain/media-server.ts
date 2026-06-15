import { z } from 'zod';

/**
 * The kind of media source a server represents. Jellyfin is the only one
 * implemented for now; Plex will be added later.
 */
export const mediaServerTypeSchema = z.enum(['jellyfin', 'plex']);
export type MediaServerType = z.infer<typeof mediaServerTypeSchema>;
export const MediaServerType = mediaServerTypeSchema.enum;

/**
 * A configured media server. `token` is the source-specific credential
 * (Jellyfin API key / Plex token) and is never returned to clients.
 */
export const mediaServerSchema = z.object({
  id: z.string(),
  type: mediaServerTypeSchema,
  name: z.string(),
  address: z.string(),
  port: z.number().int(),
  useHttps: z.boolean().default(false),
  token: z.string(),
});
export type MediaServer = z.infer<typeof mediaServerSchema>;

/**
 * A library (collection root) within a media server. `serverId`, `enabled`,
 * and `isDefault` are owned by Voids; the rest mirror the source's metadata.
 */
export const mediaLibrarySchema = z.object({
  serverId: z.string(),
  key: z.string(),
  title: z.string(),
  type: z.string(),
  collectionType: z.string().nullable(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
});
export type MediaLibrary = z.infer<typeof mediaLibrarySchema>;
