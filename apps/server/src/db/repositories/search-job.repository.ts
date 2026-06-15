import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { SearchJob, SearchJobStatus } from '@voids/shared';
import { DB } from '../db.module';
import type { DbHandle } from '../client';
import { searchJobs } from '../schema';

type JobRow = typeof searchJobs.$inferSelect;

/** Map a DB row to the API `SearchJob` (timestamps as epoch ms). */
function toSearchJob(row: JobRow): SearchJob {
  return {
    id: row.id,
    serverId: row.serverId ?? '',
    libraryKey: row.libraryKey ?? '',
    status: row.status as SearchJobStatus,
    searchedCount: row.searchedCount,
    totalCount: row.totalCount,
    startedAt: row.startedAt ? row.startedAt.getTime() : null,
    finishedAt: row.finishedAt ? row.finishedAt.getTime() : null,
    error: row.error,
  };
}

@Injectable()
export class SearchJobRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  private get db() {
    return this.handle.db;
  }

  /** Create a queued job row and return its id. */
  create(serverId: string, libraryKey: string): number {
    const res = this.db
      .insert(searchJobs)
      .values({ serverId, libraryKey, status: 'queued' })
      .returning({ id: searchJobs.id })
      .get();
    return res.id;
  }

  find(jobId: number): SearchJob | undefined {
    const row = this.db.select().from(searchJobs).where(eq(searchJobs.id, jobId)).get();
    return row ? toSearchJob(row) : undefined;
  }

  /** Raw row (for internal cancel-flag checks). */
  findRow(jobId: number): JobRow | undefined {
    return this.db.select().from(searchJobs).where(eq(searchJobs.id, jobId)).get();
  }

  update(
    jobId: number,
    patch: Partial<{
      status: SearchJobStatus;
      searchedCount: number;
      totalCount: number;
      startedAt: Date | null;
      finishedAt: Date | null;
      error: string | null;
      cancelRequested: boolean;
    }>,
  ): void {
    this.db.update(searchJobs).set(patch).where(eq(searchJobs.id, jobId)).run();
  }

  /** Whether cancellation was requested for a job (re-read from DB each call). */
  isCancelRequested(jobId: number): boolean {
    const row = this.db
      .select({ cancelRequested: searchJobs.cancelRequested })
      .from(searchJobs)
      .where(eq(searchJobs.id, jobId))
      .get();
    return row?.cancelRequested ?? false;
  }

  requestCancel(jobId: number): void {
    this.db
      .update(searchJobs)
      .set({ cancelRequested: true })
      .where(eq(searchJobs.id, jobId))
      .run();
  }

  /** Ids of jobs queued for processing, oldest first. */
  listQueuedIds(): number[] {
    return this.db
      .select({ id: searchJobs.id })
      .from(searchJobs)
      .where(eq(searchJobs.status, 'queued'))
      .all()
      .map((r) => r.id);
  }

  /** Mark stale running/queued jobs from a previous process as failed. */
  failStale(error: string): number {
    const rows = this.db
      .select({ id: searchJobs.id })
      .from(searchJobs)
      .where(inArray(searchJobs.status, ['running', 'queued']))
      .all();
    if (rows.length === 0) return 0;
    this.db
      .update(searchJobs)
      .set({ status: 'failed', error, finishedAt: new Date() })
      .where(inArray(searchJobs.status, ['running', 'queued']))
      .run();
    return rows.length;
  }
}
