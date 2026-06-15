import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import type { MislabeledResponse } from '@voids/shared';
import { MislabeledService } from './mislabeled.service';

@Controller('api')
export class MislabeledController {
  constructor(private readonly mislabeled: MislabeledService) {}

  /**
   * Likely-mislabeled owned movies for a library, where the media-server title
   * differs from the canonical TMDB title by more than `threshold` edits.
   */
  @Get('mislabeled/:serverId/:libraryKey/:threshold')
  detect(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
    @Param('threshold') threshold: string,
  ): Promise<MislabeledResponse> {
    const t = Number.parseInt(threshold, 10);
    if (Number.isNaN(t) || t < 0) {
      throw new BadRequestException('threshold must be a non-negative integer');
    }
    return this.mislabeled.detect(serverId, libraryKey, t);
  }
}
