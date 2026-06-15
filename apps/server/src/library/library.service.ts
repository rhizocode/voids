import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Movie } from '@voids/shared';
import { ServerRepository } from '../db/repositories/server.repository';
import { MovieRepository } from '../db/repositories/movie.repository';
import { MediaSourceRegistry } from '../media/media-source.registry';
import type { MediaServerConnection } from '../media/media-source.interface';
import { SettingsService } from '../config/settings.service';

/**
 * Owned-movie ingest: scan a library's movies via its MediaSource and persist
 * them into `owned_movies` (replacing prior rows for that server+library).
 * Jellyfin already populates tmdbId/imdbId/collectionId from ProviderIds, so
 * GUID resolution is essentially free.
 */
@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);

  constructor(
    private readonly servers: ServerRepository,
    private readonly movies: MovieRepository,
    private readonly registry: MediaSourceRegistry,
    private readonly settings: SettingsService,
  ) {}

  /** Scan owned movies for a library and persist them; returns the count. */
  async scan(serverId: string, libraryKey: string): Promise<number> {
    const server = this.servers.findServer(serverId);
    if (!server) throw new NotFoundException(`No server with id ${serverId}`);

    const s = this.settings.get();
    const conn: MediaServerConnection = {
      type: server.type,
      address: server.address,
      port: server.port,
      useHttps: server.useHttps,
      token: server.token,
      connectTimeoutMs: s.connectTimeoutMs,
      readTimeoutMs: s.readTimeoutMs,
    };

    const source = this.registry.get(server.type);
    const scanned = await source.listMovies(conn, libraryKey);
    const count = this.movies.replaceOwned(serverId, libraryKey, scanned);
    this.logger.log(`Scanned ${count} owned movies for ${serverId}/${libraryKey}`);
    return count;
  }

  /** Stored owned movies for a library. */
  listOwned(serverId: string, libraryKey: string): Movie[] {
    return this.movies.listOwned(serverId, libraryKey);
  }
}
