import { z } from 'zod';

/**
 * A likely-mislabeled owned movie: its media-server (owned) title differs from
 * the TMDB canonical title for the same tmdbId by more than the threshold
 * (Levenshtein distance). See gaps-reference / brief §5.
 */
export const mislabeledItemSchema = z.object({
  /** The title as stored on the media server. */
  ownedTitle: z.string(),
  /** The canonical TMDB title for this tmdbId. */
  tmdbTitle: z.string(),
  year: z.number().int().nullable(),
  tmdbId: z.number().int(),
  /** Levenshtein distance between the two titles. */
  distance: z.number().int(),
});
export type MislabeledItem = z.infer<typeof mislabeledItemSchema>;

/** Response for `GET /api/mislabeled/:serverId/:libraryKey/:threshold`. */
export const mislabeledResponseSchema = z.array(mislabeledItemSchema);
export type MislabeledResponse = z.infer<typeof mislabeledResponseSchema>;
