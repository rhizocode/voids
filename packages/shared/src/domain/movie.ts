import { z } from 'zod';

/**
 * A member of a TMDB collection (was `MovieFromCollection` in Gaps).
 * `owned` is true when a matching movie exists in the scanned library.
 */
export const collectionMemberSchema = z.object({
  title: z.string(),
  tmdbId: z.number().int().nullable(),
  year: z.number().int().nullable(),
  owned: z.boolean(),
});
export type CollectionMember = z.infer<typeof collectionMemberSchema>;

/**
 * The central movie entity (was `BasicMovie` in Gaps). `mediaItemId` /
 * `mediaItemKey` are the source-specific identifiers (Jellyfin item id, Plex
 * rating key / key) and are null for movies that come purely from TMDB.
 */
export const movieSchema = z.object({
  title: z.string(),
  year: z.number().int().nullable(),
  tmdbId: z.number().int().nullable(),
  imdbId: z.string().nullable(),
  collectionId: z.number().int().nullable(),
  collectionTitle: z.string().nullable(),
  posterUrl: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  language: z.string().default('en'),
  overview: z.string().nullable(),
  genres: z.array(z.string()),
  moviesInCollection: z.array(collectionMemberSchema),
  mediaItemId: z.string().nullable(),
  mediaItemKey: z.string().nullable(),
});
export type Movie = z.infer<typeof movieSchema>;

/**
 * Normalize a title for identity comparison. Strips the exact set of
 * characters Gaps stripped in `nameWithoutBadCharacters`:
 * `[<>`~\[\]()*&^%$#@!|{}.,?\-_=+:;]` (note: includes the backtick and `*`).
 *
 * Mirrors gaps-reference.md §Movie Identity Key.
 */
export function normalizeTitle(title: string): string {
  return title.replace(/[<>`~[\]()*&^%$#@!|{}.,?\-_=+:;]/g, '');
}

/**
 * Stable identity key for a movie, replicating Gaps' equality rule exactly:
 * - if `tmdbId` present  -> `tmdb:<id>`
 * - else if `imdbId` present -> `imdb:<id>`
 * - else -> `yt:<year>:<normalizedTitle>`
 *
 * Used everywhere ownership / dedup is checked.
 */
export function movieKey(m: Pick<Movie, 'tmdbId' | 'imdbId' | 'year' | 'title'>): string {
  if (m.tmdbId != null) return `tmdb:${m.tmdbId}`;
  if (m.imdbId != null && m.imdbId !== '') return `imdb:${m.imdbId}`;
  return `yt:${m.year ?? ''}:${normalizeTitle(m.title)}`;
}
