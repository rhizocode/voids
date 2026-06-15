import { Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
  Payload,
  type RadarrMoviesResponse,
  type RadarrPushResponse,
  type RadarrQualityProfilesResponse,
  type RadarrRootFoldersResponse,
  type RadarrTestResponse,
} from '@voids/shared';
import { RadarrService } from './radarr.service';

@Controller('api')
export class RadarrController {
  constructor(private readonly radarr: RadarrService) {}

  /** Explicit connection test → success/failure payload. Never throws. */
  @Put('radarr/test')
  @HttpCode(HttpStatus.OK)
  async test(): Promise<RadarrTestResponse> {
    if (!this.radarr.isConfigured()) {
      return { ...Payload.RADARR_NOT_CONFIGURED };
    }
    try {
      await this.radarr.testConnection();
      return { ...Payload.RADARR_CONNECTION_SUCCEEDED };
    } catch {
      return { ...Payload.RADARR_CONNECTION_FAILED };
    }
  }

  /** Cross-check: movies currently in Radarr. `[]` when unconfigured/unreachable. */
  @Get('radarr/movies')
  movies(): Promise<RadarrMoviesResponse> {
    return this.radarr.getMovies();
  }

  /** Quality profiles for the UI selector. */
  @Get('radarr/quality-profiles')
  qualityProfiles(): Promise<RadarrQualityProfilesResponse> {
    return this.radarr.getQualityProfiles();
  }

  /** Root folders for the UI selector. */
  @Get('radarr/root-folders')
  rootFolders(): Promise<RadarrRootFoldersResponse> {
    return this.radarr.getRootFolders();
  }

  /** Push approved recommendations for a library to Radarr. */
  @Post('recommended/:serverId/:libraryKey/push-radarr')
  @HttpCode(HttpStatus.OK)
  push(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
  ): Promise<RadarrPushResponse> {
    return this.radarr.pushApproved(serverId, libraryKey);
  }
}
