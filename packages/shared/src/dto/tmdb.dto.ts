import { z } from 'zod';
import { payloadResultSchema } from './payload-result';

/** Body for `PUT /api/tmdb/test` and `POST /api/tmdb/key`. */
export const tmdbKeyRequestSchema = z.object({
  apiKey: z.string().min(1),
});
export type TmdbKeyRequest = z.infer<typeof tmdbKeyRequestSchema>;

/** Response for the TMDB test / save endpoints. */
export const tmdbKeyResponseSchema = payloadResultSchema;
export type TmdbKeyResponse = z.infer<typeof tmdbKeyResponseSchema>;
