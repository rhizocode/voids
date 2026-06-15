import { Injectable, Logger } from '@nestjs/common';
import type { MislabeledItem } from '@voids/shared';
import { MovieRepository } from '../db/repositories/movie.repository';
import { TmdbCacheService } from '../tmdb/tmdb-cache.service';
import { levenshtein } from './levenshtein';

/**
 * Mislabeled detection (brief §5; faithful port per brief §18 Q3). For each
 * owned movie in a library that HAS a tmdbId, compare its stored media-server
 * title to the canonical TMDB title for that tmdbId (cache-first via
 * `TmdbCacheService`). If the Levenshtein distance exceeds `threshold`, flag it
 * as likely mislabeled. Results are sorted by distance descending.
 *
 * TMDB lookups go through the cache so re-runs and warm caches don't hammer the
 * API. A lookup failure for one movie is logged and skipped (never aborts).
 */
@Injectable()
export class MislabeledService {
  private readonly logger = new Logger(MislabeledService.name);

  constructor(
    private readonly movies: MovieRepository,
    private readonly tmdb: TmdbCacheService,
  ) {}

  /** Flagged (likely-mislabeled) owned movies for a library. */
  async detect(
    serverId: string,
    libraryKey: string,
    threshold: number,
  ): Promise<MislabeledItem[]> {
    const owned = this.movies.listOwned(serverId, libraryKey);
    const flagged: MislabeledItem[] = [];

    for (const movie of owned) {
      if (movie.tmdbId == null) continue;
      let tmdbTitle: string;
      try {
        const details = await this.tmdb.getMovie(movie.tmdbId);
        tmdbTitle = details.title ?? '';
      } catch (err) {
        this.logger.warn(
          `Mislabeled: failed to fetch TMDB ${movie.tmdbId} (${movie.title}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        continue;
      }
      if (!tmdbTitle) continue;

      const distance = levenshtein(movie.title, tmdbTitle);
      if (distance > threshold) {
        flagged.push({
          ownedTitle: movie.title,
          tmdbTitle,
          year: movie.year,
          tmdbId: movie.tmdbId,
          distance,
        });
      }
    }

    flagged.sort((a, b) => b.distance - a.distance);
    return flagged;
  }
}
