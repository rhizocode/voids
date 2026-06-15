import { z } from 'zod';
import { movieSchema } from '../domain/movie';
import { payloadCodeSchema } from '../enums/payload';

/**
 * A background search job's durable state. Timestamps are epoch-ms numbers in
 * the API (the DB stores them as unix-second timestamps; repositories convert).
 */
export const searchJobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export type SearchJobStatus = z.infer<typeof searchJobStatusSchema>;

export const searchJobSchema = z.object({
  id: z.number().int(),
  serverId: z.string(),
  libraryKey: z.string(),
  status: searchJobStatusSchema,
  searchedCount: z.number().int(),
  totalCount: z.number().int(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  error: z.string().nullable(),
});
export type SearchJob = z.infer<typeof searchJobSchema>;

/** The approval-workflow status of a recommendation. */
export const recommendedMovieStatusSchema = z.enum([
  'new',
  'approved',
  'rejected',
  'ignored',
]);
export type RecommendedMovieStatus = z.infer<typeof recommendedMovieStatusSchema>;

/** A discovered gap: the full `Movie` shape plus review/triage metadata. */
export const recommendedMovieSchema = movieSchema.extend({
  id: z.number().int(),
  status: recommendedMovieStatusSchema,
  discoveredAt: z.number(),
});
export type RecommendedMovie = z.infer<typeof recommendedMovieSchema>;

/** Result of scanning a library's owned movies. */
export const scanResultSchema = z
  .object({
    code: payloadCodeSchema,
    reason: z.string(),
    count: z.number().int(),
  })
  .passthrough();
export type ScanResult = z.infer<typeof scanResultSchema>;

/** Response for `POST /api/search/:serverId/:libraryKey`. */
export const startSearchResponseSchema = z.object({ jobId: z.number().int() });
export type StartSearchResponse = z.infer<typeof startSearchResponseSchema>;

/** Response for `GET /api/search/:jobId` (job status polling). */
export const jobStatusResponseSchema = searchJobSchema;
export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;

/** Response for `GET /api/recommended/:serverId/:libraryKey`. */
export const recommendedResponseSchema = z.array(recommendedMovieSchema);
export type RecommendedResponse = z.infer<typeof recommendedResponseSchema>;
