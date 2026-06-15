import { Injectable, Logger } from '@nestjs/common';
import type {
  RadarrConfig,
  RadarrMovie,
  RadarrPushResponse,
  RadarrPushResult,
  RadarrQualityProfile,
  RadarrRootFolder,
} from '@voids/shared';
import { SettingsService } from '../config/settings.service';
import { MovieRepository } from '../db/repositories/movie.repository';
import { RadarrClient, type RadarrConnection } from './radarr.client';

/**
 * Cross-check + push orchestration over `RadarrClient` (brief §6.3, §13.4).
 * Reads the single-user Radarr config from settings. Like the client, this
 * service degrades gracefully: when Radarr is unconfigured, reads return `[]`
 * and push returns a clear `configured:false` payload — a Radarr problem never
 * breaks a search or scheduled run.
 */
@Injectable()
export class RadarrService {
  private readonly logger = new Logger(RadarrService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly movies: MovieRepository,
    private readonly client: RadarrClient,
  ) {}

  /** The configured Radarr connection, or null when not configured. */
  private connection(): RadarrConnection | null {
    const cfg = this.settings.get().radarr;
    if (!cfg || !cfg.url || !cfg.apiKey) return null;
    const s = this.settings.get();
    return { url: cfg.url, apiKey: cfg.apiKey, timeoutMs: s.readTimeoutMs };
  }

  /** Whether Radarr is configured (has url + apiKey). */
  isConfigured(): boolean {
    return this.connection() !== null;
  }

  /**
   * Test the explicit connection. Throws on failure (the caller — the test
   * endpoint — maps that to a failure payload). Throws a clear error when
   * Radarr is not configured at all.
   */
  async testConnection(): Promise<void> {
    const conn = this.connection();
    if (!conn) throw new Error('Radarr is not configured.');
    await this.client.testConnection(conn);
  }

  /** Movies currently in Radarr (the cross-check). `[]` when unconfigured. */
  async getMovies(): Promise<RadarrMovie[]> {
    const conn = this.connection();
    if (!conn) return [];
    return this.client.listMovies(conn);
  }

  /** Quality profiles for the UI selector. `[]` when unconfigured. */
  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    const conn = this.connection();
    if (!conn) return [];
    return this.client.getQualityProfiles(conn);
  }

  /** Root folders for the UI selector. `[]` when unconfigured. */
  async getRootFolders(): Promise<RadarrRootFolder[]> {
    const conn = this.connection();
    if (!conn) return [];
    return this.client.getRootFolders(conn);
  }

  /**
   * Push every `approved` recommendation for a library to Radarr using the
   * stored Radarr defaults (quality profile, root folder, etc.). Returns a
   * per-movie result list. Recommendations without a tmdbId or with missing
   * Radarr defaults are reported as `failed` (Radarr requires both). The
   * recommendation's own status is left as `approved` (no new statuses invented).
   */
  async pushApproved(serverId: string, libraryKey: string): Promise<RadarrPushResponse> {
    const cfg = this.settings.get().radarr;
    const conn = this.connection();
    if (!cfg || !conn) {
      return { configured: false, results: [] };
    }

    const approved = this.movies.listRecommendedByStatus(serverId, libraryKey, 'approved');
    const results: RadarrPushResult[] = [];

    let transportDown = false;
    for (const movie of approved) {
      if (transportDown) {
        results.push({ tmdbId: movie.tmdbId, title: movie.title, status: 'failed', error: 'Skipped: Radarr unreachable.' });
        continue;
      }
      const result = await this.pushOne(conn, cfg, movie.title, movie.tmdbId);
      results.push(result);
      if (result.status === 'failed' && 'transport' in result && result.transport) {
        transportDown = true;
      }
    }

    const added = results.filter((r) => r.status === 'added').length;
    const exists = results.filter((r) => r.status === 'exists').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    this.logger.log(
      `pushApproved ${serverId}/${libraryKey}: ${added} added, ${exists} already present, ${failed} failed.`,
    );

    return { configured: true, results };
  }

  /** Push a single approved movie; classify the outcome. */
  private async pushOne(
    conn: RadarrConnection,
    cfg: RadarrConfig,
    title: string,
    tmdbId: number | null,
  ): Promise<RadarrPushResult & { transport?: true }> {
    if (tmdbId == null) {
      return { tmdbId: null, title, status: 'failed', error: 'Missing tmdbId.' };
    }
    if (cfg.qualityProfileId == null || cfg.rootFolderPath == null) {
      return {
        tmdbId,
        title,
        status: 'failed',
        error: 'Radarr quality profile and root folder must be configured first.',
      };
    }

    const outcome = await this.client.addMovie(conn, {
      tmdbId,
      title,
      qualityProfileId: cfg.qualityProfileId,
      rootFolderPath: cfg.rootFolderPath,
      monitored: cfg.monitored,
      minimumAvailability: cfg.minimumAvailability,
      searchOnAdd: cfg.searchOnAdd,
    });

    if (outcome.status === 'failed') {
      return { tmdbId, title, status: 'failed', error: outcome.error, ...(outcome.transport ? { transport: true as const } : {}) };
    }
    return { tmdbId, title, status: outcome.status };
  }
}
