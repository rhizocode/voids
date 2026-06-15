import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, type MediaLibrary, type MediaServer } from '@voids/shared';
import { ServerRepository } from '../db/repositories/server.repository';
import { MediaSourceRegistry } from '../media/media-source.registry';
import type { MediaServerConnection } from '../media/media-source.interface';
import { SettingsService } from '../config/settings.service';
import { LibraryService } from '../library/library.service';
import { JobRunnerService } from '../search/job-runner.service';
import { NotificationService } from '../notifications/notification.service';

/**
 * The full scheduled run (brief §4; mirrors Gaps' `SearchGapsTask`). For every
 * media server: test the connection, refresh its libraries, scan owned movies
 * for each enabled library, then enqueue a gap search per enabled library on
 * the serial job runner (which runs them one-at-a-time).
 *
 * Resilience is a hard requirement: a single server or library failing logs +
 * notifies and is skipped, never aborting the rest of the run.
 */
@Injectable()
export class SearchAllTask {
  private readonly logger = new Logger(SearchAllTask.name);

  constructor(
    private readonly servers: ServerRepository,
    private readonly registry: MediaSourceRegistry,
    private readonly settings: SettingsService,
    private readonly library: LibraryService,
    private readonly runner: JobRunnerService,
    private readonly notifications: NotificationService,
  ) {}

  /** Run the full automation pass across every configured media server. */
  async run(): Promise<void> {
    const servers = this.servers.listServers();
    this.logger.log(`SearchAllTask starting for ${servers.length} server(s).`);

    for (const server of servers) {
      try {
        await this.processServer(server);
      } catch (err) {
        // Defensive: processServer already isolates per-server failures, but a
        // surprise throw here must not abort the remaining servers.
        this.logger.error(
          `Server ${server.id} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log('SearchAllTask finished.');
  }

  private connFor(server: MediaServer): MediaServerConnection {
    const s = this.settings.get();
    return {
      type: server.type,
      address: server.address,
      port: server.port,
      useHttps: server.useHttps,
      token: server.token,
      connectTimeoutMs: s.connectTimeoutMs,
      readTimeoutMs: s.readTimeoutMs,
    };
  }

  /** Process one media server through the full pipeline. */
  private async processServer(server: MediaServer): Promise<void> {
    const source = this.registry.get(server.type);
    const conn = this.connFor(server);

    // 1. Test connection. On failure -> notify + skip this server.
    try {
      await source.testConnection(conn);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Connection test failed for server ${server.id}: ${reason}`);
      await this.notify(
        NotificationType.PLEX_SERVER_CONNECTION,
        'error',
        'Media server unreachable',
        `Could not connect to "${server.name}" (${server.id}); skipping this server.`,
      );
      return;
    }
    await this.notify(
      NotificationType.PLEX_SERVER_CONNECTION,
      'info',
      'Media server connected',
      `Connected to "${server.name}".`,
    );

    // 2. Refresh libraries from the source, persisting new/updated rows while
    //    preserving each library's enabled/isDefault flags.
    await this.refreshLibraries(server, conn);

    // 3 & 4. For each ENABLED library: scan owned movies, then enqueue a search.
    const enabled = this.servers
      .listLibraries(server.id)
      .filter((lib) => lib.enabled);

    if (enabled.length === 0) {
      this.logger.log(`Server ${server.id} has no enabled libraries; nothing to search.`);
    }

    for (const lib of enabled) {
      await this.processLibrary(server, lib);
    }

    // 6. TODO(Phase 6): if settings.autoPushRadarr, push approved recommendations
    //    to Radarr here. Intentionally a no-op hook — Radarr is out of scope for
    //    Phase 4 and must NOT be implemented yet.
    //    if (this.settings.get().autoPushRadarr) { /* push approved -> Radarr */ }
  }

  /** Re-list libraries from the source and persist, keeping flags intact. */
  private async refreshLibraries(server: MediaServer, conn: MediaServerConnection): Promise<void> {
    const source = this.registry.get(server.type);
    try {
      const discovered = await source.listLibraries(conn);
      for (const lib of discovered) {
        const existing = this.servers.findLibrary(server.id, lib.key);
        this.servers.upsertLibrary({
          ...lib,
          serverId: server.id,
          enabled: existing?.enabled ?? lib.enabled,
          isDefault: existing?.isDefault ?? lib.isDefault,
        });
      }
      await this.notify(
        NotificationType.PLEX_LIBRARY_UPDATE,
        'info',
        'Libraries refreshed',
        `Refreshed ${discovered.length} librar${discovered.length === 1 ? 'y' : 'ies'} on "${server.name}".`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Library refresh failed for server ${server.id}: ${reason}`);
      await this.notify(
        NotificationType.PLEX_LIBRARY_UPDATE,
        'error',
        'Library refresh failed',
        `Could not refresh libraries on "${server.name}"; using last-known list.`,
      );
    }
  }

  /** Scan + enqueue a search for one enabled library, isolating failures. */
  private async processLibrary(server: MediaServer, lib: MediaLibrary): Promise<void> {
    try {
      const count = await this.library.scan(server.id, lib.key);
      await this.notify(
        NotificationType.PLEX_METADATA_UPDATE,
        'info',
        'Owned movies scanned',
        `Scanned ${count} owned movie(s) in "${lib.title}".`,
      );
      const jobId = this.runner.enqueue(server.id, lib.key);
      this.logger.log(`Enqueued search job ${jobId} for ${server.id}/${lib.key}.`);
      // The GAPS_MISSING_COLLECTIONS notification fires from SearchService when
      // the enqueued job completes (decoupled — see search.service.ts).
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Library ${server.id}/${lib.key} failed during scan/enqueue: ${reason}`,
      );
      await this.notify(
        NotificationType.PLEX_METADATA_UPDATE,
        'error',
        'Library scan failed',
        `Could not scan "${lib.title}"; skipping its search.`,
      );
    }
  }

  /** Fire a notification without letting a dispatch error break the run. */
  private async notify(
    type: NotificationType,
    level: 'info' | 'warn' | 'error',
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.notifications.notify(type, level, title, body);
    } catch (err) {
      this.logger.warn(
        `Notification dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
