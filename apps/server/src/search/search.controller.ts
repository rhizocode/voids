import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import type {
  JobStatusResponse,
  RecommendedMovie,
  StartSearchResponse,
} from '@voids/shared';
import { JobRunnerService } from './job-runner.service';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { MovieRepository } from '../db/repositories/movie.repository';

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
    this.runner.requestCancel(Number(jobId));
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
}
