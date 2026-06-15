import { Injectable, Logger } from '@nestjs/common';
import type {
  RadarrMovie,
  RadarrQualityProfile,
  RadarrRootFolder,
} from '@voids/shared';

/** Resolved connection details for a Radarr v3 instance. */
export interface RadarrConnection {
  /** Base URL, e.g. `http://10.0.0.5:7878` (trailing slash tolerated). */
  url: string;
  apiKey: string;
  /** Per-request timeout (ms). */
  timeoutMs?: number;
}

/** Arguments for adding a movie to Radarr. */
export interface RadarrAddMovieArgs {
  tmdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored: boolean;
  minimumAvailability: string;
  searchOnAdd: boolean;
}

/** Outcome of an add-movie call. */
export type RadarrAddOutcome =
  | { status: 'added' }
  | { status: 'exists' }
  | { status: 'failed'; error: string; transport?: true };

const DEFAULT_TIMEOUT_MS = 10000;

interface RadarrMovieRaw {
  tmdbId?: number | null;
  imdbId?: string | null;
  title?: string;
  year?: number | null;
  hasFile?: boolean;
  monitored?: boolean;
}

interface RadarrQualityProfileRaw {
  id?: number;
  name?: string;
}

interface RadarrRootFolderRaw {
  path?: string;
  freeSpace?: number | null;
}

/** A Radarr v3 error body (subset). */
interface RadarrErrorEntry {
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Radarr v3 HTTP client (brief §6.3). Auth via `X-Api-Key`. Every method is
 * built for **graceful degradation**: a Radarr outage must never break a search
 * or scheduled run — read methods catch errors and return `[]`, `addMovie`
 * returns a `failed` outcome instead of throwing, and only `testConnection`
 * (the explicit user-initiated test) throws so the caller can report the error.
 *
 * The API key is never logged: error messages strip it and URLs are not logged.
 */
@Injectable()
export class RadarrClient {
  private readonly logger = new Logger(RadarrClient.name);

  /** Join base URL + path, tolerating a trailing slash on the base. */
  private endpoint(conn: RadarrConnection, path: string): string {
    const base = conn.url.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  /** Issue a request with the API-key header and a timeout. */
  private async request(
    conn: RadarrConnection,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      conn.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      return await fetch(this.endpoint(conn, path), {
        ...init,
        signal: controller.signal,
        headers: {
          'X-Api-Key': conn.apiKey,
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * `GET /api/v3/system/status` — the explicit connection test. Resolves on a
   * 2xx response; throws a clear (key-free) error otherwise so the test
   * endpoint can report success/failure.
   */
  async testConnection(conn: RadarrConnection): Promise<void> {
    let res: Response;
    try {
      res = await this.request(conn, '/api/v3/system/status');
    } catch (err) {
      throw new Error(`Could not reach Radarr: ${RadarrClient.safeMessage(err)}`);
    }
    if (!res.ok) {
      throw new Error(`Radarr returned HTTP ${res.status} for system status.`);
    }
  }

  /** `GET /api/v3/movie` — parsed movie list. Returns `[]` on any error. */
  async listMovies(conn: RadarrConnection): Promise<RadarrMovie[]> {
    try {
      const res = await this.request(conn, '/api/v3/movie');
      if (!res.ok) {
        this.logger.warn(`Radarr listMovies HTTP ${res.status}; returning empty list.`);
        return [];
      }
      const raw = (await res.json()) as RadarrMovieRaw[];
      if (!Array.isArray(raw)) return [];
      return raw.map((m) => ({
        tmdbId: m.tmdbId ?? null,
        imdbId: m.imdbId ?? null,
        title: m.title ?? '',
        year: m.year ?? null,
        hasFile: m.hasFile ?? false,
        monitored: m.monitored ?? false,
      }));
    } catch (err) {
      this.logger.warn(`Radarr listMovies failed: ${RadarrClient.safeMessage(err)}`);
      return [];
    }
  }

  /** `GET /api/v3/qualityprofile` — `[{id,name}]`. Returns `[]` on any error. */
  async getQualityProfiles(conn: RadarrConnection): Promise<RadarrQualityProfile[]> {
    try {
      const res = await this.request(conn, '/api/v3/qualityprofile');
      if (!res.ok) {
        this.logger.warn(`Radarr qualityprofile HTTP ${res.status}; returning empty.`);
        return [];
      }
      const raw = (await res.json()) as RadarrQualityProfileRaw[];
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((p): p is { id: number; name: string } => p.id != null)
        .map((p) => ({ id: p.id, name: p.name ?? '' }));
    } catch (err) {
      this.logger.warn(`Radarr getQualityProfiles failed: ${RadarrClient.safeMessage(err)}`);
      return [];
    }
  }

  /** `GET /api/v3/rootfolder` — `[{path,...}]`. Returns `[]` on any error. */
  async getRootFolders(conn: RadarrConnection): Promise<RadarrRootFolder[]> {
    try {
      const res = await this.request(conn, '/api/v3/rootfolder');
      if (!res.ok) {
        this.logger.warn(`Radarr rootfolder HTTP ${res.status}; returning empty.`);
        return [];
      }
      const raw = (await res.json()) as RadarrRootFolderRaw[];
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((f): f is { path: string } => typeof f.path === 'string')
        .map((f) => ({ path: f.path, freeSpace: (f as RadarrRootFolderRaw).freeSpace ?? null }));
    } catch (err) {
      this.logger.warn(`Radarr getRootFolders failed: ${RadarrClient.safeMessage(err)}`);
      return [];
    }
  }

  /**
   * `POST /api/v3/movie` (Radarr v3 add). Never throws: returns `added` on
   * success, `exists` when Radarr reports the movie is already added (HTTP 400
   * with a "MovieExistsValidator"/"already been added" error), and `failed`
   * with a sanitized message otherwise.
   */
  async addMovie(
    conn: RadarrConnection,
    args: RadarrAddMovieArgs,
  ): Promise<RadarrAddOutcome> {
    const body = {
      tmdbId: args.tmdbId,
      title: args.title,
      qualityProfileId: args.qualityProfileId,
      rootFolderPath: args.rootFolderPath,
      monitored: args.monitored,
      minimumAvailability: args.minimumAvailability,
      addOptions: { searchForMovie: args.searchOnAdd },
    };

    let res: Response;
    try {
      res = await this.request(conn, '/api/v3/movie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return { status: 'failed', error: RadarrClient.safeMessage(err), transport: true };
    }

    if (res.ok) return { status: 'added' };

    // Read the error body to distinguish "already exists" (non-fatal) from a
    // genuine failure. Radarr v3 returns 400 with an array of error entries.
    let text = '';
    try {
      text = await res.text();
    } catch {
      // ignore body read errors
    }
    if (res.status === 400 && RadarrClient.isAlreadyExists(text)) {
      return { status: 'exists' };
    }
    return {
      status: 'failed',
      error: `HTTP ${res.status}${text ? `: ${RadarrClient.firstErrorMessage(text)}` : ''}`,
    };
  }

  /** Detect Radarr's "movie already exists" 400 response. */
  private static isAlreadyExists(body: string): boolean {
    const lowered = body.toLowerCase();
    return (
      lowered.includes('already been added') ||
      lowered.includes('movieexists') ||
      lowered.includes('this movie has already been added')
    );
  }

  /** Pull the first human-readable error message from a Radarr error body. */
  private static firstErrorMessage(body: string): string {
    try {
      const parsed = JSON.parse(body) as RadarrErrorEntry[] | RadarrErrorEntry;
      const entry = Array.isArray(parsed) ? parsed[0] : parsed;
      if (entry?.errorMessage) return entry.errorMessage;
    } catch {
      // not JSON — fall through
    }
    return body.slice(0, 200);
  }

  /** Stringify an error without ever leaking the API key. */
  private static safeMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
