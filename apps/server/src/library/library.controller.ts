import { Controller, Get, Param, Post } from '@nestjs/common';
import { Payload, type Movie, type ScanResult } from '@voids/shared';
import { LibraryService } from './library.service';

@Controller('api')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  /** Scan + persist a library's owned movies. */
  @Post('libraries/:serverId/:libraryKey/scan')
  async scan(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
  ): Promise<ScanResult> {
    const count = await this.library.scan(serverId, libraryKey);
    return { ...Payload.PLEX_LIBRARY_MOVIE_FOUND, count };
  }

  /** Stored owned movies for a library. */
  @Get('owned/:serverId/:libraryKey')
  owned(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
  ): Movie[] {
    return this.library.listOwned(serverId, libraryKey);
  }

  /**
   * Legacy alias of the scan endpoint (brief §10 `GET /api/plex/movies/:id/:key`).
   * Kept trivial for parity; the generic route above is preferred.
   */
  @Get('plex/movies/:serverId/:libraryKey')
  async legacyScan(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
  ): Promise<ScanResult> {
    const count = await this.library.scan(serverId, libraryKey);
    return { ...Payload.PLEX_LIBRARY_MOVIE_FOUND, count };
  }
}
