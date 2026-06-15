import { z } from 'zod';

/**
 * Whether to recommend unreleased movies.
 * ALL  (0) — recommend everything in a collection.
 * RELEASED (1) — only recommend movies that have been released.
 */
export const MovieStatus = {
  ALL: { id: 0, label: 'All' },
  RELEASED: { id: 1, label: 'Released' },
} as const;

export type MovieStatusName = keyof typeof MovieStatus;

export const movieStatusIdSchema = z.union([z.literal(0), z.literal(1)]);
export type MovieStatusId = z.infer<typeof movieStatusIdSchema>;

export function movieStatusById(id: number): (typeof MovieStatus)[MovieStatusName] | undefined {
  return Object.values(MovieStatus).find((s) => s.id === id);
}
