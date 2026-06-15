import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { SearchJobStatus } from '@voids/shared';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { SearchService } from './search.service';

/**
 * In-process serial job queue: at most one search runs at a time (matches the
 * original Gaps behavior and avoids hammering TMDB). The `search_jobs` row is
 * the durable truth, so headless/scheduled runs complete with no client
 * connected; the WebSocket is purely a live accelerant.
 */
@Injectable()
export class JobRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobRunnerService.name);
  private readonly queue: number[] = [];
  private running = false;

  constructor(
    private readonly jobs: SearchJobRepository,
    private readonly search: SearchService,
  ) {}

  /** On boot, fail stale jobs and re-arm any still-queued ones. */
  onApplicationBootstrap(): void {
    const failed = this.jobs.failStale('Interrupted by restart');
    if (failed > 0) {
      this.logger.warn(`Marked ${failed} stale job(s) as failed (interrupted by restart)`);
    }
    // Any jobs persisted as queued after the failStale pass (none, since
    // failStale covers queued too) would be re-armed here; failStale already
    // clears them, so the queue starts empty.
  }

  /** Create a queued job and schedule it; returns the new job id. */
  enqueue(serverId: string, libraryKey: string): number {
    const jobId = this.jobs.create(serverId, libraryKey);
    this.queue.push(jobId);
    void this.drain();
    return jobId;
  }

  /**
   * Enqueue a search and resolve once the job reaches a terminal state
   * (`succeeded` | `failed` | `cancelled`), returning the final status. Used by
   * the scheduled run so it can act on results (e.g. auto-push to Radarr) only
   * after the search actually finishes. Polls the DB-backed job row, which is
   * the durable source of truth.
   */
  async enqueueAndWait(
    serverId: string,
    libraryKey: string,
    opts: { pollMs?: number; timeoutMs?: number } = {},
  ): Promise<{ jobId: number; status: SearchJobStatus }> {
    const pollMs = opts.pollMs ?? 100;
    const timeoutMs = opts.timeoutMs ?? 30 * 60 * 1000;
    const jobId = this.enqueue(serverId, libraryKey);
    const deadline = Date.now() + timeoutMs;
    const terminal: SearchJobStatus[] = ['succeeded', 'failed', 'cancelled'];
    for (;;) {
      const job = this.jobs.find(jobId);
      if (job && terminal.includes(job.status)) {
        return { jobId, status: job.status };
      }
      if (Date.now() > deadline) {
        this.logger.warn(`enqueueAndWait timed out waiting for job ${jobId}`);
        return { jobId, status: job?.status ?? 'failed' };
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  /** Request cancellation; works mid-run (the engine polls between movies). */
  requestCancel(jobId: number): void {
    this.jobs.requestCancel(jobId);
    // Drop a not-yet-started job from the in-memory queue too.
    const idx = this.queue.indexOf(jobId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      this.jobs.update(jobId, { status: 'cancelled', finishedAt: new Date() });
    }
  }

  /** Process queued jobs one at a time. */
  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const jobId = this.queue.shift() as number;
        const job = this.jobs.find(jobId);
        if (!job || job.status !== 'queued') continue; // cancelled before start
        try {
          await this.search.runSearch(job.serverId, job.libraryKey, jobId);
        } catch (err) {
          // runSearch already records failures; this guards against unexpected throws.
          this.logger.error(
            `Unexpected error running job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
          );
          this.jobs.update(jobId, {
            status: 'failed',
            finishedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
