import { z } from 'zod';
import { mediaServerSchema, mediaServerTypeSchema, mediaLibrarySchema } from '../domain/media-server';
import { payloadResultSchema } from './payload-result';

/**
 * A media server as returned to clients: the `token` is stripped for security
 * and its libraries are embedded.
 */
export const mediaServerViewSchema = mediaServerSchema.omit({ token: true }).extend({
  libraries: z.array(mediaLibrarySchema),
});
export type MediaServerView = z.infer<typeof mediaServerViewSchema>;

/** Response for `GET /api/servers`. */
export const serversResponseSchema = z.array(mediaServerViewSchema);
export type ServersResponse = z.infer<typeof serversResponseSchema>;

/** Body for `POST /api/servers` — connection details to test then persist. */
export const addServerRequestSchema = z.object({
  type: mediaServerTypeSchema,
  address: z.string().min(1),
  port: z.number().int(),
  useHttps: z.boolean().default(false),
  token: z.string().min(1),
});
export type AddServerRequest = z.infer<typeof addServerRequestSchema>;

/** Response for `POST /api/servers` and `PUT /api/servers/:id/test` connection result. */
export const serverTestResponseSchema = payloadResultSchema;
export type ServerTestResponse = z.infer<typeof serverTestResponseSchema>;

/** Body for `PUT /api/servers/:id/libraries/:key` — toggle library flags. */
export const updateLibraryRequestSchema = z.object({
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateLibraryRequest = z.infer<typeof updateLibraryRequestSchema>;

/** Response for library reads/updates. */
export const libraryResponseSchema = mediaLibrarySchema;
export type LibraryResponse = z.infer<typeof libraryResponseSchema>;

/** Response for `GET /api/libraries` — all libraries flattened across servers. */
export const librariesResponseSchema = z.array(mediaLibrarySchema);
export type LibrariesResponse = z.infer<typeof librariesResponseSchema>;
