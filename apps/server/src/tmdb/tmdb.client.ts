import { Injectable, Logger } from '@nestjs/common';

/** TMDB API v3 base URL. */
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TmdbAuthResponse {
  success?: boolean;
}

/**
 * Minimal TMDB client for Phase 1 — just key validation. The full client
 * (search, details, collections, cache, rate limiting) arrives in Phase 2.
 */
@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);

  /**
   * Validate an API key against `GET /authentication`. Returns true on a 200
   * response with `{ success: true }`; false on any failure (never throws).
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
}
