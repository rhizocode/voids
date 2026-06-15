import { Injectable, Logger } from '@nestjs/common';
import {
  MovieStatus,
  NotificationType,
  Payload,
  movieKey,
  type CollectionMember,
  type Movie,
} from '@voids/shared';
import { MovieRepository } from '../db/repositories/movie.repository';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { SettingsService } from '../config/settings.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationService } from '../notifications/notification.service';
import {
  TmdbCacheService,
} from '../tmdb/tmdb-cache.service';
import {
  backdropUrl,
  posterUrl,
  type TmdbCollectionPart,
  type TmdbMovie,
} from '../tmdb/tmdb.client';

/** Raised internally to short-circuit a cancelled run. */
class SearchCancelledError extends Error {}

/**
 * The gap-finding engine. Faithful to gaps-reference §1 + brief §7: for each
 * owned movie it resolves a TMDB id + collection id (cache-first), fetches the
 * collection, and records the parts the library is missing as recommendations.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly movies: MovieRepository,
    private readonly jobs: SearchJobRepository,
    private readonly settings: SettingsService,
    private readonly tmdb: TmdbCacheService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationService,
  ) {}

  /** Run a search for one library, persisting progress/results as it goes. */
  async runSearch(serverId: string, libraryKey: string, jobId: number): Promise<void> {
    const owned = this.movies.listOwned(serverId, libraryKey);
    this.jobs.update(jobId, {
      status: 'running',
      totalCount: owned.length,
      searchedCount: 0,
      startedAt: new Date(),
    });

    // Ownership index keyed by movieKey for O(1) ownership/dedup checks.
    const ownedKeys = new Set<string>(owned.map((m) => movieKey(m)));
    // movieKeys already processed this run (owned + recommended) to skip dups.
    const searched = new Set<string>();

    const movieStatus = this.settings.get().movieStatus;
    let processed = 0;
    let found = 0;

    try {
      for (const ownedMovie of owned) {
        if (this.jobs.isCancelRequested(jobId)) {
          throw new SearchCancelledError();
        }

        const key = movieKey(ownedMovie);
        if (searched.has(key)) {
          // Duplicate within the run; still counts as processed.
          processed += 1;
          this.jobs.update(jobId, { searchedCount: processed });
          this.emitProgress(jobId, processed, owned.length);
          continue;
        }
        searched.add(key);

        try {
          found += await this.processOwnedMovie(
            serverId,
            libraryKey,
            jobId,
            ownedMovie,
            ownedKeys,
            searched,
            movieStatus,
            owned.length,
          );
        } catch (err) {
          if (err instanceof SearchCancelledError) throw err;
          const key = movieKey(ownedMovie);
          this.logger.warn(
            `Skipping movie ${key}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        processed += 1;
        this.jobs.update(jobId, { searchedCount: processed });
        this.emitProgress(jobId, processed, owned.length);
      }

      this.jobs.update(jobId, { status: 'succeeded', finishedAt: new Date() });
      this.realtime.emitFinished({
        jobId,
        payloadCode: Payload.SEARCH_SUCCESSFUL.code,
        reason: Payload.SEARCH_SUCCESSFUL.reason,
      });
      // Fire the search-finished notification with the count of gaps found this
      // run (brief §4.5). Decoupled: the stub just logs today; Phase 5 fans out.
      // TODO(phase-5): RSS feed is written incrementally elsewhere; nothing here.
      await this.notifyFinished(serverId, libraryKey, found);
    } catch (err) {
      if (err instanceof SearchCancelledError) {
        this.jobs.update(jobId, { status: 'cancelled', finishedAt: new Date() });
        this.realtime.emitFinished({
          jobId,
          payloadCode: Payload.SEARCH_CANCELLED.code,
          reason: Payload.SEARCH_CANCELLED.reason,
        });
        return;
      }
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Search job ${jobId} failed: ${reason}`);
      this.jobs.update(jobId, { status: 'failed', finishedAt: new Date(), error: reason });
      this.realtime.emitFinished({
        jobId,
        payloadCode: Payload.SEARCH_FAILED.code,
        reason,
      });
    }
  }

  /**
   * Resolve, fetch collection, and record any missing parts for one owned
   * movie. Returns the number of new recommendations found for this movie.
   */
  private async processOwnedMovie(
    serverId: string,
    libraryKey: string,
    jobId: number,
    ownedMovie: Movie,
    ownedKeys: Set<string>,
    searched: Set<string>,
    movieStatus: number,
    total: number,
  ): Promise<number> {
    const resolved = await this.resolveCollectionId(ownedMovie);
    if (resolved == null) return 0; // no collection -> no siblings

    const collection = await this.tmdb.getCollection(resolved);
    if (!collection) return 0; // not found (status_code 34) or empty

    let found = 0;
    for (const part of collection.parts) {
      const partKeyInput = { tmdbId: part.id, imdbId: null, year: part.year, title: part.title };
      const partKey = movieKey(partKeyInput);

      if (ownedKeys.has(partKey) || searched.has(partKey)) continue;

      // MovieStatus filter (gaps-reference §1): RELEASED requires a release date
      // AND TMDB status === 'Released'; ALL includes everything.
      let details: TmdbMovie | null = null;
      if (movieStatus === MovieStatus.RELEASED.id) {
        if (!part.releaseDate) continue;
        details = await this.tmdb.getMovie(part.id);
        if ((details.status ?? '').toLowerCase() !== 'released') continue;
      } else {
        details = await this.tmdb.getMovie(part.id);
      }

      const recommended = this.buildRecommended(part, details, collection);
      this.movies.upsertRecommended(serverId, libraryKey, recommended);
      searched.add(partKey);
      found += 1;

      // A gap was found — emit progress carrying the movie payload.
      this.emitProgress(jobId, this.jobs.find(jobId)?.searchedCount ?? 0, total, recommended);
    }
    return found;
  }

  /**
   * Fire the GAPS_MISSING_COLLECTIONS notification after a successful run.
   * Decoupled hook point (brief §4.5): the stub logs today; Phase 5 fans out to
   * the configured providers. Never throws into the run.
   */
  private async notifyFinished(
    serverId: string,
    libraryKey: string,
    found: number,
  ): Promise<void> {
    try {
      await this.notifications.notify(
        NotificationType.GAPS_MISSING_COLLECTIONS,
        'info',
        'Gap search finished',
        found > 0
          ? `Found ${found} missing movie(s) for library ${serverId}/${libraryKey}.`
          : `No new gaps found for library ${serverId}/${libraryKey}.`,
      );
    } catch (err) {
      this.logger.warn(
        `Notification dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Resolve the owned movie's collection id, cache-first, by best signal.
   * Returns the collection id, or null when the movie has no collection.
   */
  private async resolveCollectionId(movie: Movie): Promise<number | null> {
    // (i) already have both -> use the collection id directly.
    if (movie.tmdbId != null && movie.collectionId != null) {
      return movie.collectionId;
    }
    // (ii) have tmdbId -> details -> collection id.
    if (movie.tmdbId != null) {
      const details = await this.tmdb.getMovie(movie.tmdbId);
      return details.collectionId;
    }
    // (iii) have imdbId -> find -> tmdbId -> details.
    if (movie.imdbId != null && movie.imdbId !== '') {
      const tmdbId = await this.tmdb.findByImdb(movie.imdbId);
      if (tmdbId == null) return null;
      const details = await this.tmdb.getMovie(tmdbId);
      return details.collectionId;
    }
    // (iv) else -> search by title/year -> tmdbId -> details.
    const tmdbId = await this.tmdb.searchMovie(movie.title, movie.year);
    if (tmdbId == null) return null;
    const details = await this.tmdb.getMovie(tmdbId);
    return details.collectionId;
  }

  /** Build a recommended `Movie` from a collection part + enriched details. */
  private buildRecommended(
    part: TmdbCollectionPart,
    details: TmdbMovie,
    collection: { id: number; name: string },
  ): Movie {
    return {
      title: details.title || part.title,
      year: details.year ?? part.year,
      tmdbId: details.id,
      imdbId: details.imdbId,
      collectionId: collection.id,
      collectionTitle: collection.name,
      posterUrl: posterUrl(details.posterPath ?? part.posterPath),
      backdropUrl: backdropUrl(details.backdropPath ?? part.backdropPath),
      language: 'en',
      overview: details.overview ?? part.overview,
      genres: details.genres,
      moviesInCollection: [],
      mediaItemId: null,
      mediaItemKey: null,
    };
  }

  private emitProgress(
    jobId: number,
    searchedCount: number,
    totalCount: number,
    movie?: Movie,
  ): void {
    this.realtime.emitProgress({ jobId, searchedCount, totalCount, movie });
  }
}

/**
 * Build the `CollectionMember[]` for a collection given the owned-key set.
 * Exported for unit testing and potential reuse in the recommendations view.
 */
export function buildCollectionMembers(
  parts: TmdbCollectionPart[],
  ownedKeys: Set<string>,
): CollectionMember[] {
  return parts.map((p) => ({
    title: p.title,
    tmdbId: p.id,
    year: p.year,
    owned: ownedKeys.has(movieKey({ tmdbId: p.id, imdbId: null, year: p.year, title: p.title })),
  }));
}
