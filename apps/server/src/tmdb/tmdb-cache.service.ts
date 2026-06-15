import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module';
import type { DbHandle } from '../db/client';
import { movieCache, collectionCache } from '../db/schema';
import {
  TmdbClient,
  type TmdbCollection,
  type TmdbCollectionPart,
  type TmdbMovie,
} from './tmdb.client';

/** Default TTLs (ms): movies live 30 days, collections 7 days. */
const DEFAULT_MOVIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_COLLECTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TmdbCacheOptions {
  movieTtlMs?: number;
  collectionTtlMs?: number;
}

/** Optional DI token to override cache TTLs (mainly for tests). */
export const TMDB_CACHE_OPTIONS = Symbol('TMDB_CACHE_OPTIONS');

type MovieCacheRow = typeof movieCache.$inferSelect;
type CollectionCacheRow = typeof collectionCache.$inferSelect;

/**
 * Cache-first wrapper over `TmdbClient` backed by `movie_cache` /
 * `collection_cache`. Reads check the cache (respecting `fetched_at` TTL) and
 * write through on miss, so warm runs are mostly DB operations (brief §7).
 *
 * Exposes a small "network call" counter so verification can confirm cache
 * effectiveness; it is incremented on every actual TMDB fetch.
 */
@Injectable()
export class TmdbCacheService {
  private readonly logger = new Logger(TmdbCacheService.name);
  private readonly movieTtlMs: number;
  private readonly collectionTtlMs: number;
  /** Count of real network fetches issued (search/find excluded — cache-bypassing). */
  networkCalls = 0;

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly tmdb: TmdbClient,
    @Optional() @Inject(TMDB_CACHE_OPTIONS) options: TmdbCacheOptions = {},
  ) {
    this.movieTtlMs = options.movieTtlMs ?? DEFAULT_MOVIE_TTL_MS;
    this.collectionTtlMs = options.collectionTtlMs ?? DEFAULT_COLLECTION_TTL_MS;
  }

  private get db() {
    return this.handle.db;
  }

  private fresh(fetchedAt: Date | null, ttlMs: number): boolean {
    if (!fetchedAt) return false;
    return Date.now() - fetchedAt.getTime() < ttlMs;
  }

  private static rowToMovie(row: MovieCacheRow): TmdbMovie {
    return {
      id: row.tmdbId,
      title: row.title ?? '',
      imdbId: row.imdbId,
      collectionId: row.collectionId,
      collectionTitle: row.collectionTitle,
      collectionBackdropPath: null,
      genres: (row.genres as string[] | null) ?? [],
      status: row.releaseStatus,
      releaseDate: row.releaseDate,
      year: row.year,
      posterPath: row.posterPath,
      backdropPath: row.backdropPath,
      overview: null,
    };
  }

  /** Cache-first `GET /movie/{tmdbId}`. */
  async getMovie(tmdbId: number): Promise<TmdbMovie> {
    const cached = this.db
      .select()
      .from(movieCache)
      .where(eq(movieCache.tmdbId, tmdbId))
      .get();
    if (cached && this.fresh(cached.fetchedAt, this.movieTtlMs)) {
      return TmdbCacheService.rowToMovie(cached);
    }

    this.networkCalls += 1;
    const movie = await this.tmdb.getMovie(tmdbId);
    this.writeMovie(movie);
    return movie;
  }

  private writeMovie(movie: TmdbMovie): void {
    const values = {
      tmdbId: movie.id,
      imdbId: movie.imdbId,
      title: movie.title,
      year: movie.year,
      collectionId: movie.collectionId,
      collectionTitle: movie.collectionTitle,
      genres: movie.genres,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      releaseStatus: movie.status,
      releaseDate: movie.releaseDate,
      fetchedAt: new Date(),
    };
    this.db
      .insert(movieCache)
      .values(values)
      .onConflictDoUpdate({ target: movieCache.tmdbId, set: values })
      .run();
  }

  private static rowToCollection(row: CollectionCacheRow): TmdbCollection {
    return {
      id: row.collectionId,
      name: row.name ?? '',
      backdropPath: row.backdropPath,
      parts: ((row.parts as TmdbCollectionPart[] | null) ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        releaseDate: p.releaseDate ?? null,
        year: p.year ?? null,
        posterPath: p.posterPath ?? null,
        backdropPath: p.backdropPath ?? null,
        overview: p.overview ?? null,
      })),
    };
  }

  /** Cache-first `GET /collection/{id}`; null on not-found (status_code 34). */
  async getCollection(collectionId: number): Promise<TmdbCollection | null> {
    const cached = this.db
      .select()
      .from(collectionCache)
      .where(eq(collectionCache.collectionId, collectionId))
      .get();
    if (cached && this.fresh(cached.fetchedAt, this.collectionTtlMs)) {
      return TmdbCacheService.rowToCollection(cached);
    }

    this.networkCalls += 1;
    const collection = await this.tmdb.getCollection(collectionId);
    if (collection) this.writeCollection(collection);
    return collection;
  }

  private writeCollection(collection: TmdbCollection): void {
    const values = {
      collectionId: collection.id,
      name: collection.name,
      backdropPath: collection.backdropPath,
      parts: collection.parts,
      fetchedAt: new Date(),
    };
    this.db
      .insert(collectionCache)
      .values(values)
      .onConflictDoUpdate({ target: collectionCache.collectionId, set: values })
      .run();
  }

  /** Search/find are not cached (cheap, identity-resolving); pass-through. */
  searchMovie(title: string, year?: number | null): Promise<number | null> {
    this.networkCalls += 1;
    return this.tmdb.searchMovie(title, year);
  }

  findByImdb(imdbId: string): Promise<number | null> {
    this.networkCalls += 1;
    return this.tmdb.findByImdb(imdbId);
  }
}
