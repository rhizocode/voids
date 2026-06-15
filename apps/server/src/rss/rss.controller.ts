import { Controller, Get, Header, Param } from '@nestjs/common';
import type { RssFeedInfo, RssItem } from '@voids/shared';
import { RssService } from './rss.service';

/**
 * Public feed endpoint, mounted OUTSIDE `/api` so it stays reachable by Radarr
 * without auth (Phase 7 auth will exempt `/rss/**`). The static SPA module
 * already excludes `/rss/**` from its index.html fallback, so this never
 * collides with client-side routing.
 */
@Controller('rss')
export class RssFeedController {
  constructor(private readonly rss: RssService) {}

  /** The JSON feed Radarr polls. Always `application/json`, even when empty. */
  @Get(':serverId/:libraryKey')
  @Header('Content-Type', 'application/json')
  feed(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
  ): RssItem[] {
    return this.rss.buildFeed(serverId, libraryKey);
  }
}

/** Lists which feeds exist (for the UI). Lives under `/api`. */
@Controller('api')
export class RssController {
  constructor(private readonly rss: RssService) {}

  @Get('rss')
  list(): RssFeedInfo[] {
    return this.rss.listFeeds();
  }
}
