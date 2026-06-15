import { Injectable } from '@nestjs/common';
import type { MediaServerType } from '@voids/shared';
import type { MediaSource } from './media-source.interface';
import { JellyfinClient } from './jellyfin.client';

/**
 * Maps a media server `type` to its `MediaSource` implementation. Only
 * Jellyfin is registered for now; unsupported types throw a clear error so
 * Plex can slot in later.
 */
@Injectable()
export class MediaSourceRegistry {
  private readonly sources: Map<MediaServerType, MediaSource>;

  constructor(jellyfin: JellyfinClient) {
    this.sources = new Map<MediaServerType, MediaSource>([[jellyfin.type, jellyfin]]);
  }

  get(type: MediaServerType): MediaSource {
    const source = this.sources.get(type);
    if (!source) {
      throw new Error(`Unsupported media server type: ${type}`);
    }
    return source;
  }
}
