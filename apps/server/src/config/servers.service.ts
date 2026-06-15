import { Injectable, Logger } from '@nestjs/common';
import type {
  AddServerRequest,
  MediaLibrary,
  MediaServer,
  MediaServerView,
} from '@voids/shared';
import { ServerRepository } from '../db/repositories/server.repository';
import { MediaSourceRegistry } from '../media/media-source.registry';
import type { MediaServerConnection, MediaServerInfo } from '../media/media-source.interface';
import { SettingsService } from './settings.service';

/** Thrown when a media server connection test fails. */
export class ServerConnectionError extends Error {}

@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);

  constructor(
    private readonly repo: ServerRepository,
    private readonly registry: MediaSourceRegistry,
    private readonly settings: SettingsService,
  ) {}

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

  /** All servers with their libraries, tokens stripped. */
  listServerViews(): MediaServerView[] {
    return this.repo.listServers().map((server) => {
      const libs = this.repo.listLibraries(server.id);
      return this.toView(server, libs);
    });
  }

  private toView(server: MediaServer, libs: MediaLibrary[]): MediaServerView {
    return {
      id: server.id,
      type: server.type,
      name: server.name,
      address: server.address,
      port: server.port,
      useHttps: server.useHttps,
      libraries: libs,
    };
  }

  /**
   * Test the connection, discover libraries, and persist the server. If the
   * server id already exists it is updated (treated as a duplicate add).
   * Existing libraries keep their enabled/isDefault flags.
   */
  async addServer(req: AddServerRequest): Promise<MediaServerView> {
    const source = this.registry.get(req.type);
    const s = this.settings.get();
    const conn: MediaServerConnection = {
      type: req.type,
      address: req.address,
      port: req.port,
      useHttps: req.useHttps,
      token: req.token,
      connectTimeoutMs: s.connectTimeoutMs,
      readTimeoutMs: s.readTimeoutMs,
    };

    let info: MediaServerInfo;
    try {
      info = await source.testConnection(conn);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Connection test failed for ${req.type} ${req.address}:${req.port}`);
      throw new ServerConnectionError(message);
    }

    let discovered: MediaLibrary[];
    try {
      discovered = await source.listLibraries(conn);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Library listing failed for ${req.type} ${req.address}:${req.port}`);
      throw new ServerConnectionError(message);
    }

    const server: MediaServer = {
      id: info.id,
      type: req.type,
      name: info.name,
      address: req.address,
      port: req.port,
      useHttps: req.useHttps,
      token: req.token,
    };
    this.repo.upsertServer(server);

    for (const lib of discovered) {
      const existing = this.repo.findLibrary(server.id, lib.key);
      this.repo.upsertLibrary({
        ...lib,
        serverId: server.id,
        enabled: existing?.enabled ?? lib.enabled,
        isDefault: existing?.isDefault ?? lib.isDefault,
      });
    }

    return this.toView(server, this.repo.listLibraries(server.id));
  }

  /** Re-run the connection test against a stored server. Throws if unknown. */
  async testServer(id: string): Promise<MediaServerInfo> {
    const server = this.repo.findServer(id);
    if (!server) {
      throw new ServerConnectionError(`No server with id ${id}`);
    }
    const source = this.registry.get(server.type);
    try {
      return await source.testConnection(this.connFor(server));
    } catch (err) {
      throw new ServerConnectionError(err instanceof Error ? err.message : String(err));
    }
  }

  deleteServer(id: string): void {
    this.repo.deleteServer(id);
  }

  listAllLibraries(): MediaLibrary[] {
    return this.repo.listLibraries();
  }

  updateLibrary(
    serverId: string,
    key: string,
    flags: { enabled?: boolean; isDefault?: boolean },
  ): MediaLibrary | undefined {
    return this.repo.updateLibraryFlags(serverId, key, flags);
  }
}
