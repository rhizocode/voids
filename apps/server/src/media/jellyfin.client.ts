import { Injectable } from '@nestjs/common';
import type { MediaLibrary, MediaServerType, Movie } from '@voids/shared';
import type {
  MediaServerConnection,
  MediaServerInfo,
  MediaSource,
} from './media-source.interface';

/** Raw Jellyfin `/System/Info` shape (subset). */
export interface JellyfinSystemInfo {
  Id: string;
  ServerName: string;
  Version: string;
}

/** Raw Jellyfin `/Library/VirtualFolders` entry (subset). */
export interface JellyfinVirtualFolder {
  Name: string;
  CollectionType?: string | null;
  ItemId: string;
}

/** Raw Jellyfin `/Items` entry (subset of fields we request). */
export interface JellyfinItem {
  Id: string;
  Name: string;
  ProductionYear?: number | null;
  Overview?: string | null;
  Genres?: string[] | null;
  ProviderIds?: Record<string, string> | null;
}

/** Raw Jellyfin `/Items` response (subset). */
export interface JellyfinItemsResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
}

const MOVIE_PAGE_SIZE = 500;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_READ_TIMEOUT_MS = 60000;

function parseProviderInt(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

/** Map a single Jellyfin item to the shared `Movie` domain type. */
export function mapJellyfinItemToMovie(item: JellyfinItem): Movie {
  const providers = item.ProviderIds ?? {};
  return {
    title: item.Name,
    year: item.ProductionYear ?? null,
    tmdbId: parseProviderInt(providers.Tmdb),
    imdbId: providers.Imdb ?? null,
    collectionId: parseProviderInt(providers.TmdbCollection),
    collectionTitle: null,
    posterUrl: null,
    backdropUrl: null,
    language: 'en',
    overview: item.Overview ?? null,
    genres: item.Genres ?? [],
    moviesInCollection: [],
    mediaItemId: item.Id,
    mediaItemKey: item.Id,
  };
}

/** Map Jellyfin virtual folders to movie libraries (movies collection only). */
export function mapJellyfinVirtualFolders(folders: JellyfinVirtualFolder[]): MediaLibrary[] {
  return folders
    .filter((f) => f.CollectionType === 'movies')
    .map((f) => ({
      serverId: '',
      key: f.ItemId,
      title: f.Name,
      type: 'movie',
      collectionType: f.CollectionType ?? null,
      enabled: false,
      isDefault: false,
    }));
}

@Injectable()
export class JellyfinClient implements MediaSource {
  readonly type: MediaServerType = 'jellyfin';

  private baseUrl(conn: MediaServerConnection): string {
    const scheme = conn.useHttps ? 'https' : 'http';
    return `${scheme}://${conn.address}:${conn.port}`;
  }

  /**
   * Perform an authenticated GET with the API key in the `X-Emby-Token`
   * header (never a query param, to avoid leaking it in logs/URLs) and a
   * combined connect+read timeout via AbortController.
   */
  private async get<T>(conn: MediaServerConnection, path: string): Promise<T> {
    const timeoutMs =
      (conn.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS) +
      (conn.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl(conn)}${path}`, {
        method: 'GET',
        headers: {
          'X-Emby-Token': conn.token,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Jellyfin request to ${path} failed: HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Jellyfin request to ${path} timed out after ${timeoutMs}ms`);
      }
      if (err instanceof Error && err.message.startsWith('Jellyfin request')) {
        throw err;
      }
      throw new Error(
        `Jellyfin request to ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(conn: MediaServerConnection): Promise<MediaServerInfo> {
    const info = await this.get<JellyfinSystemInfo>(conn, '/System/Info');
    return { id: info.Id, name: info.ServerName, version: info.Version };
  }

  async listLibraries(conn: MediaServerConnection): Promise<MediaLibrary[]> {
    const folders = await this.get<JellyfinVirtualFolder[]>(conn, '/Library/VirtualFolders');
    return mapJellyfinVirtualFolders(folders);
  }

  async listMovies(conn: MediaServerConnection, libraryKey: string): Promise<Movie[]> {
    const movies: Movie[] = [];
    let startIndex = 0;
    let total = Infinity;

    while (startIndex < total) {
      const path =
        `/Items?ParentId=${encodeURIComponent(libraryKey)}` +
        `&IncludeItemTypes=Movie&Recursive=true` +
        `&Fields=ProviderIds,Genres,ProductionYear,Overview` +
        `&StartIndex=${startIndex}&Limit=${MOVIE_PAGE_SIZE}`;
      const page = await this.get<JellyfinItemsResponse>(conn, path);
      total = page.TotalRecordCount;
      for (const item of page.Items) {
        movies.push(mapJellyfinItemToMovie(item));
      }
      if (page.Items.length === 0) break;
      startIndex += page.Items.length;
    }

    return movies;
  }
}
