import { z } from 'zod';
import { movieSchema } from '../domain/movie';
import { payloadCodeSchema } from '../enums/payload';

/**
 * WebSocket message envelope used over `/ws`. Both directions use the same
 * `{ event, data }` JSON shape; `event` discriminates the payload. The web
 * `useJobProgress` hook must match this exactly.
 */
export const WS_EVENTS = {
  JOB_PROGRESS: 'job:progress',
  JOB_FINISHED: 'job:finished',
  JOB_CANCEL: 'job:cancel',
} as const;

/** server -> client: incremental progress; `movie` present when a gap was found. */
export const jobProgressEventSchema = z.object({
  jobId: z.number().int(),
  searchedCount: z.number().int(),
  totalCount: z.number().int(),
  movie: movieSchema.optional(),
});
export type JobProgressEvent = z.infer<typeof jobProgressEventSchema>;

/** server -> client: terminal job result. */
export const jobFinishedEventSchema = z.object({
  jobId: z.number().int(),
  payloadCode: payloadCodeSchema,
  reason: z.string().optional(),
});
export type JobFinishedEvent = z.infer<typeof jobFinishedEventSchema>;

/** client -> server: request cancellation of a running/queued job. */
export const jobCancelMessageSchema = z.object({
  jobId: z.number().int(),
});
export type JobCancelMessage = z.infer<typeof jobCancelMessageSchema>;

/** Generic `{ event, data }` envelope (typed per event by the consumer). */
export const wsEnvelopeSchema = z.object({
  event: z.string(),
  data: z.unknown(),
});
export type WsEnvelope = z.infer<typeof wsEnvelopeSchema>;
