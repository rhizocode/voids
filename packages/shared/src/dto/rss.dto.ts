import { z } from 'zod';
import { rssItemSchema } from '../domain/rss';

/**
 * The public RSS/JSON feed body served at `GET /rss/:serverId/:libraryKey` — a
 * bare array of `RssItem`s (StevenLu-style custom list for Radarr).
 */
export const rssFeedResponseSchema = z.array(rssItemSchema);
export type RssFeedResponse = z.infer<typeof rssFeedResponseSchema>;

/**
 * Metadata about an available feed, returned by `GET /api/rss` for each library
 * that has at least one non-rejected/ignored recommendation.
 */
export const rssFeedInfoSchema = z.object({
  serverId: z.string(),
  libraryKey: z.string(),
  title: z.string(),
  url: z.string(),
  count: z.number().int(),
});
export type RssFeedInfo = z.infer<typeof rssFeedInfoSchema>;

/** Response for `GET /api/rss`. */
export const rssFeedListResponseSchema = z.array(rssFeedInfoSchema);
export type RssFeedListResponse = z.infer<typeof rssFeedListResponseSchema>;
