import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { Movie, RecommendedMovie, RecommendedMovieStatus } from '@voids/shared';
import { DB } from '../db.module';
import type { DbHandle } from '../client';
import { ownedMovies, recommendedMovies } from '../schema';

type OwnedRow = typeof ownedMovies.$inferSelect;
type RecommendedRow = typeof recommendedMovies.$inferSelect;

function rowToMovie(row: OwnedRow): Movie {
  return {
    title: row.title,
    year: row.year,
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    collectionId: row.collectionId,
    collectionTitle: row.collectionTitle,
    posterUrl: row.posterUrl,
    backdropUrl: row.backdropUrl,
    language: row.language,
    overview: row.overview,
    genres: (row.genres as string[] | null) ?? [],
    moviesInCollection: [],
    mediaItemId: row.mediaItemId,
    mediaItemKey: row.mediaItemKey,
  };
}

function recRowToMovie(row: RecommendedRow): RecommendedMovie {
  return {
    id: row.id,
    status: row.status as RecommendedMovieStatus,
    discoveredAt: row.discoveredAt.getTime(),
    title: row.title,
    year: row.year,
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    collectionId: row.collectionId,
    collectionTitle: row.collectionTitle,
    posterUrl: row.posterUrl,
    backdropUrl: row.backdropUrl,
    language: row.language,
    overview: row.overview,
    genres: (row.genres as string[] | null) ?? [],
    moviesInCollection: [],
    // Recommendations come purely from TMDB; they have no source media item.
    mediaItemId: null,
    mediaItemKey: null,
  };
}

/** Repository for owned + recommended movies in a library. */
@Injectable()
export class MovieRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  private get db() {
    return this.handle.db;
  }

  /** Replace all owned movies for a (serverId, libraryKey) with `movies`. */
  replaceOwned(serverId: string, libraryKey: string, movies: Movie[]): number {
    return this.db.transaction((tx) => {
      tx.delete(ownedMovies)
        .where(and(eq(ownedMovies.serverId, serverId), eq(ownedMovies.libraryKey, libraryKey)))
        .run();
      if (movies.length === 0) return 0;
      const values = movies.map((m) => ({
        serverId,
        libraryKey,
        title: m.title,
        year: m.year,
        tmdbId: m.tmdbId,
        imdbId: m.imdbId,
        collectionId: m.collectionId,
        collectionTitle: m.collectionTitle,
        posterUrl: m.posterUrl,
        backdropUrl: m.backdropUrl,
        language: m.language,
        overview: m.overview,
        genres: m.genres,
        mediaItemId: m.mediaItemId,
        mediaItemKey: m.mediaItemKey,
      }));
      // Chunk to stay under SQLite's bound-variable limit.
      const CHUNK = 200;
      for (let i = 0; i < values.length; i += CHUNK) {
        tx.insert(ownedMovies).values(values.slice(i, i + CHUNK)).run();
      }
      return movies.length;
    });
  }

  /** All owned movies for a library. */
  listOwned(serverId: string, libraryKey: string): Movie[] {
    return this.db
      .select()
      .from(ownedMovies)
      .where(and(eq(ownedMovies.serverId, serverId), eq(ownedMovies.libraryKey, libraryKey)))
      .all()
      .map(rowToMovie);
  }

  /**
   * Upsert a recommended movie keyed by (serverId, libraryKey, tmdbId).
   * Inserts with status='new' when new; preserves the existing row's status on
   * re-run (idempotent), refreshing the enriched fields.
   */
  upsertRecommended(serverId: string, libraryKey: string, movie: Movie): void {
    const tmdbId = movie.tmdbId;
    const existing = tmdbId
      ? this.db
          .select()
          .from(recommendedMovies)
          .where(
            and(
              eq(recommendedMovies.serverId, serverId),
              eq(recommendedMovies.libraryKey, libraryKey),
              eq(recommendedMovies.tmdbId, tmdbId),
            ),
          )
          .get()
      : undefined;

    if (existing) {
      // Preserve status + discoveredAt; refresh enriched metadata.
      this.db
        .update(recommendedMovies)
        .set({
          title: movie.title,
          year: movie.year,
          imdbId: movie.imdbId,
          collectionId: movie.collectionId,
          collectionTitle: movie.collectionTitle,
          posterUrl: movie.posterUrl,
          backdropUrl: movie.backdropUrl,
          language: movie.language,
          overview: movie.overview,
          genres: movie.genres,
        })
        .where(eq(recommendedMovies.id, existing.id))
        .run();
      return;
    }

    this.db
      .insert(recommendedMovies)
      .values({
        serverId,
        libraryKey,
        title: movie.title,
        year: movie.year,
        tmdbId: movie.tmdbId,
        imdbId: movie.imdbId,
        collectionId: movie.collectionId,
        collectionTitle: movie.collectionTitle,
        posterUrl: movie.posterUrl,
        backdropUrl: movie.backdropUrl,
        language: movie.language,
        overview: movie.overview,
        genres: movie.genres,
        status: 'new',
      })
      .run();
  }

  /** Recommended movies for a library, ordered by collection then discovery. */
  listRecommended(serverId: string, libraryKey: string): RecommendedMovie[] {
    return this.db
      .select()
      .from(recommendedMovies)
      .where(
        and(
          eq(recommendedMovies.serverId, serverId),
          eq(recommendedMovies.libraryKey, libraryKey),
        ),
      )
      .orderBy(asc(recommendedMovies.collectionId), asc(recommendedMovies.discoveredAt))
      .all()
      .map(recRowToMovie);
  }
}
