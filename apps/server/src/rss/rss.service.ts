import { Injectable, OnModuleInit } from '@nestjs/common';
import type { RecommendedMovie, RssFeedInfo, RssItem } from '@voids/shared';
import { MovieRepository } from '../db/repositories/movie.repository';
import { ServerRepository } from '../db/repositories/server.repository';

/**
 * Builds the public JSON feed Radarr consumes (StevenLu-style custom list).
 *
 * Improvement over Gaps: the original wrote a JSON file per
 * `{machineIdentifier}_{libraryKey}_movies.json` and updated it incrementally
 * as recommendations were found. We hold the same data in `recommended_movies`
 * and serve the feed on demand from the DB, so there is no file to write or
 * keep in sync — the feed is always current and reflects approval-workflow
 * status changes immediately.
 */
@Injectable()
export class RssService implements OnModuleInit {
  constructor(
    private readonly movies: MovieRepository,
    private readonly servers: ServerRepository,
  ) {}

  /** Ensure every library row has a feed token (backfill for existing installs). */
  onModuleInit(): void {
    this.servers.backfillFeedTokens();
  }

  /**
   * Map a recommendation to the Radarr feed shape with the EXACT snake_case
   * keys from gaps-reference §5: `title`, `imdb_id`, `tmdb_id`,
   * `release_date` (year as integer), `poster_path` (full image URL; empty
   * string when the source had no poster, per quirk #7).
   */
  static toRssItem(movie: RecommendedMovie): RssItem {
    return {
      title: movie.title,
      imdb_id: movie.imdbId ?? null,
      tmdb_id: movie.tmdbId ?? null,
      release_date: movie.year ?? null,
      poster_path: movie.posterUrl ?? '',
    };
  }

  /**
   * The feed for one library, addressed by its unguessable feed token.
   * Returns an empty array for an unknown or mismatched token (no 404 leak).
   */
  buildFeed(serverId: string, feedToken: string): RssItem[] {
    const lib = this.servers.findLibraryByToken(serverId, feedToken);
    if (!lib) return [];
    return this.movies
      .listRecommendedForFeed(serverId, lib.key)
      .map((m) => RssService.toRssItem(m));
  }

  /**
   * Which feeds exist: one entry per library that has at least one
   * feed-eligible recommendation, with its resolved title and public URL.
   */
  listFeeds(): RssFeedInfo[] {
    return this.movies.feedCounts().map(({ serverId, libraryKey, count }) => {
      const library = this.servers.findLibrary(serverId, libraryKey);
      const feedToken = this.servers.findFeedToken(serverId, libraryKey);
      return {
        serverId,
        libraryKey,
        title: library?.title ?? libraryKey,
        url: feedToken ? `/rss/${serverId}/${feedToken}` : '',
        count,
      };
    });
  }
}
