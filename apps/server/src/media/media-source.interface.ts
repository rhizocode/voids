import type { MediaLibrary, MediaServerType, Movie } from '@voids/shared';

/** Connection details needed to reach a media server. */
export interface MediaServerConnection {
  type: MediaServerType;
  address: string;
  port: number;
  useHttps: boolean;
  token: string;
  /** Optional per-call timeouts (ms). */
  connectTimeoutMs?: number;
  readTimeoutMs?: number;
}

/** Identity / version info reported by a media server. */
export interface MediaServerInfo {
  id: string;
  name: string;
  version: string;
}

/**
 * A pluggable media source (Jellyfin now; Plex later). Implementations are
 * stateless; all connection state is passed per call.
 */
export interface MediaSource {
  readonly type: MediaServerType;

  /** Verify the connection; resolves with server info or throws on failure. */
  testConnection(conn: MediaServerConnection): Promise<MediaServerInfo>;

  /**
   * List the server's movie libraries. `serverId`, `enabled`, and `isDefault`
   * are left for the caller to populate (defaulted to '' / false here).
   */
  listLibraries(conn: MediaServerConnection): Promise<MediaLibrary[]>;

  /** List the owned movies in a library, with source identifiers populated. */
  listMovies(conn: MediaServerConnection, libraryKey: string): Promise<Movie[]>;
}
