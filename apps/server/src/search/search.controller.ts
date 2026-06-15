import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type {
  JobStatusResponse,
  RecommendedMovie,
  StartSearchResponse,
} from '@voids/shared';
import { JobRunnerService } from './job-runner.service';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { MovieRepository } from '../db/repositories/movie.repository';
import { BulkUpdateRecommendationDto, UpdateRecommendationDto } from './dto';

@Controller('api')
export class SearchController {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly jobs: SearchJobRepository,
    private readonly movies: MovieRepository,
  ) {}

  /**
   * Request cancellation of a running/queued job. Declared BEFORE the
   * `search/:serverId/:libraryKey` start route so Express matches the more
   * specific `.../cancel` path first (both are 3-segment POSTs).
   */
  @Post('search/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('jobId') jobId: string): { ok: true } {
    const id = Number(jobId);
    if (!Number.isInteger(id)) throw new BadRequestException(`Invalid jobId: ${jobId}`);
    this.runner.requestCancel(id);
    return { ok: true };
  }

  /** Enqueue a search for a library. */
  @Post('search/:serverId/:libraryKey')
  start(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
  ): StartSearchResponse {
    const jobId = this.runner.enqueue(serverId, libraryKey);
    return { jobId };
  }

  /** Poll a job's status. */
  @Get('search/:jobId')
  status(@Param('jobId') jobId: string): JobStatusResponse {
    const job = this.jobs.find(Number(jobId));
    if (!job) throw new NotFoundException(`No job with id ${jobId}`);
    return job;
  }

  /** Recommended movies (gaps) for a library. */
  @Get('recommended/:serverId/:libraryKey')
  recommended(
    @Param('serverId') serverId: string,
    @Param('libraryKey') libraryKey: string,
  ): RecommendedMovie[] {
    return this.movies.listRecommended(serverId, libraryKey);
  }

  /**
   * Bulk approval-workflow update. Declared BEFORE the `:itemId` route so the
   * collection path (no id segment) is matched first.
   */
  @Patch('recommended')
  updateManyStatus(@Body() body: BulkUpdateRecommendationDto): { updated: number } {
    const updated = this.movies.updateRecommendedStatusBulk(body.ids, body.status);
    return { updated };
  }

  /** Set a single recommendation's approval status. 404 if it does not exist. */
  @Patch('recommended/:itemId')
  updateStatus(
    @Param('itemId') itemId: string,
    @Body() body: UpdateRecommendationDto,
  ): RecommendedMovie {
    const updated = this.movies.updateRecommendedStatus(Number(itemId), body.status);
    if (!updated) throw new NotFoundException(`No recommendation with id ${itemId}`);
    return updated;
  }
}
