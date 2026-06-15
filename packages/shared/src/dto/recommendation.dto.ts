import { z } from 'zod';
import { recommendedMovieStatusSchema } from './search.dto';

/**
 * Body for `PATCH /api/recommended/:itemId` — the approval-workflow status
 * transition. Validated at the API boundary by the shared schema.
 */
export const updateRecommendationRequestSchema = z.object({
  status: recommendedMovieStatusSchema,
});
export type UpdateRecommendationRequest = z.infer<typeof updateRecommendationRequestSchema>;

/**
 * Body for the optional bulk variant `PATCH /api/recommended` — apply one
 * status to many recommendation ids at once.
 */
export const bulkUpdateRecommendationRequestSchema = z.object({
  ids: z.array(z.number().int()).min(1),
  status: recommendedMovieStatusSchema,
});
export type BulkUpdateRecommendationRequest = z.infer<
  typeof bulkUpdateRecommendationRequestSchema
>;
