import { z } from 'zod';

/**
 * A single RSS feed entry, serialized with snake_case keys for Radarr
 * compatibility (per gaps-reference.md §RSS Feed). `release_date` is the year
 * as an integer; `poster_path` is the full image URL.
 */
export const rssItemSchema = z.object({
  title: z.string(),
  imdb_id: z.string().nullable(),
  tmdb_id: z.number().int().nullable(),
  release_date: z.number().int().nullable(),
  poster_path: z.string().nullable(),
});
export type RssItem = z.infer<typeof rssItemSchema>;
