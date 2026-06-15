import { z } from 'zod';
import { payloadResultSchema } from './payload-result';

/**
 * A movie as it exists in Radarr (parsed from `GET /api/v3/movie`). Used for
 * the cross-check endpoint and to annotate recommendations already in Radarr.
 */
export const radarrMovieSchema = z.object({
  tmdbId: z.number().int().nullable(),
  imdbId: z.string().nullable(),
  title: z.string(),
  year: z.number().int().nullable(),
  hasFile: z.boolean(),
  monitored: z.boolean(),
});
export type RadarrMovie = z.infer<typeof radarrMovieSchema>;

/** Response for `GET /api/radarr/movies`. */
export const radarrMoviesResponseSchema = z.array(radarrMovieSchema);
export type RadarrMoviesResponse = z.infer<typeof radarrMoviesResponseSchema>;

/** A Radarr quality profile (`GET /api/v3/qualityprofile`). */
export const radarrQualityProfileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export type RadarrQualityProfile = z.infer<typeof radarrQualityProfileSchema>;

export const radarrQualityProfilesResponseSchema = z.array(radarrQualityProfileSchema);
export type RadarrQualityProfilesResponse = z.infer<
  typeof radarrQualityProfilesResponseSchema
>;

/** A Radarr root folder (`GET /api/v3/rootfolder`). */
export const radarrRootFolderSchema = z.object({
  path: z.string(),
  freeSpace: z.number().nullable().optional(),
});
export type RadarrRootFolder = z.infer<typeof radarrRootFolderSchema>;

export const radarrRootFoldersResponseSchema = z.array(radarrRootFolderSchema);
export type RadarrRootFoldersResponse = z.infer<typeof radarrRootFoldersResponseSchema>;

/** Response for `PUT /api/radarr/test` — a payload result (success/failure). */
export const radarrTestResponseSchema = payloadResultSchema;
export type RadarrTestResponse = z.infer<typeof radarrTestResponseSchema>;

/** Per-movie outcome of pushing approved recommendations to Radarr. */
export const radarrPushResultSchema = z.object({
  tmdbId: z.number().int().nullable(),
  title: z.string(),
  /** `added` (newly created), `exists` (already in Radarr), or `failed`. */
  status: z.enum(['added', 'exists', 'failed']),
  error: z.string().optional(),
});
export type RadarrPushResult = z.infer<typeof radarrPushResultSchema>;

/**
 * Response for `POST /api/recommended/:serverId/:libraryKey/push-radarr`.
 * `configured` is false (with an empty `results`) when Radarr is not set up.
 */
export const radarrPushResponseSchema = z.object({
  configured: z.boolean(),
  results: z.array(radarrPushResultSchema),
});
export type RadarrPushResponse = z.infer<typeof radarrPushResponseSchema>;
