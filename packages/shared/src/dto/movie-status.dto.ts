import { z } from 'zod';
import { movieStatusIdSchema } from '../enums/movie-status';

/** Response for `GET /api/movie-status` and `PUT /api/movie-status`. */
export const movieStatusResponseSchema = z.object({
  id: movieStatusIdSchema,
  label: z.string(),
});
export type MovieStatusResponse = z.infer<typeof movieStatusResponseSchema>;

/** Body for `PUT /api/movie-status`. */
export const updateMovieStatusRequestSchema = z.object({
  movieStatus: movieStatusIdSchema,
});
export type UpdateMovieStatusRequest = z.infer<typeof updateMovieStatusRequestSchema>;
