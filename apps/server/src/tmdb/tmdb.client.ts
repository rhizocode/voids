import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../config/settings.service';
import { loadEnv } from '../config/env';
import { RateLimiter, fetchJson } from '../common/rate-limiter';

/** TMDB API v3 base URL. */
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_LANGUAGE = 'en-US';

/** Build a poster URL (`w185`) from a TMDB path; null when path is missing. */
export function posterUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_IMAGE_BASE}/w185${path}` : null;
}

/** Build a backdrop URL (`original`) from a TMDB path; null when path is missing. */
export function backdropUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_IMAGE_BASE}/original${path}` : null;
}

/** Year (number) extracted from a TMDB `yyyy-MM-dd` release date; null if absent. */
export function yearFromReleaseDate(releaseDate: string | null | undefined): number | null {
  if (!releaseDate) return null;
  const y = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

interface TmdbAuthResponse {
  success?: boolean;
}

interface TmdbBelongsToCollection {
  id: number;
  name: string;
  backdrop_path: string | null;
}

interface TmdbGenre {
  id: number;
  name: string;
}

/** Parsed `GET /movie/{id}` response. */
export interface TmdbMovie {
  id: number;
  title: string;
  imdbId: string | null;
  collectionId: number | null;
  collectionTitle: string | null;
  collectionBackdropPath: string | null;
  genres: string[];
  status: string | null;
  releaseDate: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
}

interface TmdbMovieRaw {
  id: number;
  title?: string;
  imdb_id?: string | null;
  belongs_to_collection?: TmdbBelongsToCollection | null;
  genres?: TmdbGenre[];
  status?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
}

/** A part of a collection as returned by `GET /collection/{id}`. */
export interface TmdbCollectionPart {
  id: number;
  title: string;
  releaseDate: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
}

/** Parsed `GET /collection/{id}` response. */
export interface TmdbCollection {
  id: number;
  name: string;
  backdropPath: string | null;
  parts: TmdbCollectionPart[];
}

interface TmdbCollectionPartRaw {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
}

interface TmdbCollectionRaw {
  id?: number;
  name?: string;
  backdrop_path?: string | null;
  parts?: TmdbCollectionPartRaw[];
  status_code?: number;
}

interface TmdbSearchResponse {
  results?: { id: number }[];
}

interface TmdbFindResponse {
  movie_results?: { id: number }[];
}

/**
 * Full TMDB client: key validation, search/find/details/collection, with a
 * token-bucket rate limiter + retry. The API key is read from settings; if
 * absent, the data methods throw a clear error. Network calls never log the
 * key (it travels as a query param but URLs are never logged).
 */
@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);
  private readonly limiter: RateLimiter;

  constructor(private readonly settings?: SettingsService) {
    const rate = loadEnv().tmdbRateLimit;
    this.limiter = new RateLimiter({ ratePerSecond: rate });
  }

  /** The configured TMDB key, or throw a clear error when unset. */
  private getApiKey(): string {
    const key = this.settings?.get().tmdbApiKey;
    if (!key) {
      throw new Error('TMDB API key is not configured. Set it in Settings first.');
    }
    return key;
  }

  private buildUrl(path: string, params: Record<string, string | undefined>): string {
    const url = new URL(`${TMDB_BASE_URL}${path}`);
    url.searchParams.set('api_key', this.getApiKey());
    url.searchParams.set('language', TMDB_LANGUAGE);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
    return url.toString();
  }

  /** The configured read timeout (ms) from network settings, if available. */
  private get readTimeoutMs(): number | undefined {
    return this.settings?.get().readTimeoutMs;
  }

  private get<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const url = this.buildUrl(path, params);
    const timeoutMs = this.readTimeoutMs;
    return this.limiter.run(() =>
      fetchJson<T>(
        url,
        { method: 'GET', headers: { Accept: 'application/json' } },
        { timeoutMs },
      ),
    );
  }

  /**
   * Validate an API key against `GET /authentication`. Returns true on a 200
   * response with `{ success: true }`; false on any failure (never throws).
   * Does not use the configured key (the candidate key is passed in).
   */
  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${TMDB_BASE_URL}/authentication?api_key=${encodeURIComponent(apiKey)}`,
        { method: 'GET', headers: { Accept: 'application/json' } },
      );
      if (!res.ok) return false;
      const body = (await res.json()) as TmdbAuthResponse;
      return body.success === true;
    } catch (err) {
      this.logger.warn(
        `TMDB key validation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /** `GET /search/movie` — first result's id, or null. */
  async searchMovie(title: string, year?: number | null): Promise<number | null> {
    const body = await this.get<TmdbSearchResponse>('/search/movie', {
      query: title,
      year: year != null ? String(year) : undefined,
      page: '1',
      include_adult: 'false',
    });
    return body.results?.[0]?.id ?? null;
  }

  /** `GET /find/{imdbId}` (external_source=imdb_id) — first movie result id, or null. */
  async findByImdb(imdbId: string): Promise<number | null> {
    const body = await this.get<TmdbFindResponse>(`/find/${encodeURIComponent(imdbId)}`, {
      external_source: 'imdb_id',
    });
    return body.movie_results?.[0]?.id ?? null;
  }

  /** `GET /movie/{tmdbId}` — parsed details. */
  async getMovie(tmdbId: number): Promise<TmdbMovie> {
    const raw = await this.get<TmdbMovieRaw>(`/movie/${tmdbId}`, {});
    return TmdbClient.parseMovie(raw);
  }

  /** `GET /collection/{collectionId}` — parsed; null on not-found (status_code 34). */
  async getCollection(collectionId: number): Promise<TmdbCollection | null> {
    const raw = await this.get<TmdbCollectionRaw>(`/collection/${collectionId}`, {});
    if (raw.status_code === 34 || raw.id == null) return null;
    return TmdbClient.parseCollection(raw);
  }

  /** Map a raw movie payload to the typed `TmdbMovie`. */
  static parseMovie(raw: TmdbMovieRaw): TmdbMovie {
    const col = raw.belongs_to_collection ?? null;
    return {
      id: raw.id,
      title: raw.title ?? '',
      imdbId: raw.imdb_id ?? null,
      collectionId: col?.id ?? null,
      collectionTitle: col?.name ?? null,
      collectionBackdropPath: col?.backdrop_path ?? null,
      genres: (raw.genres ?? []).map((g) => g.name),
      status: raw.status ?? null,
      releaseDate: raw.release_date && raw.release_date !== '' ? raw.release_date : null,
      year: yearFromReleaseDate(raw.release_date),
      posterPath: raw.poster_path ?? null,
      backdropPath: raw.backdrop_path ?? null,
      overview: raw.overview && raw.overview !== '' ? raw.overview : null,
    };
  }

  /** Map a raw collection payload to the typed `TmdbCollection`. */
  static parseCollection(raw: TmdbCollectionRaw): TmdbCollection {
    return {
      id: raw.id as number,
      name: raw.name ?? '',
      backdropPath: raw.backdrop_path ?? null,
      parts: (raw.parts ?? []).map((p) => ({
        id: p.id,
        title: p.title ?? p.name ?? '',
        releaseDate: p.release_date && p.release_date !== '' ? p.release_date : null,
        year: yearFromReleaseDate(p.release_date),
        posterPath: p.poster_path ?? null,
        backdropPath: p.backdrop_path ?? null,
        overview: p.overview && p.overview !== '' ? p.overview : null,
      })),
    };
  }
}
