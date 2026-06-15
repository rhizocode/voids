import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { ScheduleConfig } from '@voids/shared';
import { loadEnv } from '../config/env';
import { SettingsService } from '../config/settings.service';
import { SearchAllTask } from './search-all.task';
import { quartzToCron } from './cron.util';

/** The single dynamic cron job name registered for the scheduled full run. */
export const SEARCH_ALL_JOB = 'voids-search-all';

/**
 * Owns the single data-driven cron job that triggers a full `SearchAllTask`
 * run (brief §8). The schedule lives in `settings.schedule`; this service
 * (re)registers a dynamic `CronJob` via `SchedulerRegistry` whenever it is
 * enabled. Invalid cron is logged and skipped — it never crashes boot.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly settings: SettingsService,
    private readonly searchAll: SearchAllTask,
  ) {}

  /** On boot, register the cron job from the stored schedule (if enabled). */
  onApplicationBootstrap(): void {
    this.apply(this.settings.get().schedule);
  }

  /**
   * Re-register the cron job from the current settings. Called by the schedule
   * PUT endpoint after persisting. Idempotent: removes any existing job first,
   * then registers from the new config (or leaves it removed if disabled).
   */
  reschedule(): void {
    this.apply(this.settings.get().schedule);
  }

  /** Remove the existing job (if any) and register from the given config. */
  private apply(schedule: ScheduleConfig): void {
    this.removeJob();

    if (!schedule.enabled) {
      this.logger.log('Schedule disabled; no cron job registered.');
      return;
    }

    let cron: string;
    try {
      cron = quartzToCron(schedule.cron);
    } catch (err) {
      this.logger.error(
        `Skipping schedule registration — invalid cron "${schedule.cron}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    try {
      const job = CronJob.from({
        cronTime: cron,
        timeZone: loadEnv().timezone,
        onTick: () => {
          void this.runScheduled();
        },
      });
      this.registry.addCronJob(SEARCH_ALL_JOB, job);
      job.start();
      this.logger.log(`Registered cron job "${SEARCH_ALL_JOB}" (${cron}).`);
    } catch (err) {
      this.logger.error(
        `Failed to register cron job: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Remove the dynamic cron job if it exists; safe when none is registered. */
  private removeJob(): void {
    if (this.registry.doesExist('cron', SEARCH_ALL_JOB)) {
      // Stop then delete to release the underlying timer.
      try {
        const existing = this.registry.getCronJob(SEARCH_ALL_JOB);
        existing.stop();
      } catch {
        // getCronJob can throw if already gone; ignore.
      }
      this.registry.deleteCronJob(SEARCH_ALL_JOB);
      this.logger.log(`Removed existing cron job "${SEARCH_ALL_JOB}".`);
    }
  }

  /**
   * Run `SearchAllTask` if no run is already in progress; otherwise log and
   * skip. Used by both the cron tick and the manual `POST /api/schedule/run`.
   */
  async run(): Promise<void> {
    if (this.running) {
      this.logger.warn('Search-all already in progress — skipping.');
      return;
    }
    this.running = true;
    try {
      await this.searchAll.run();
    } catch (err) {
      this.logger.error(
        `Search-all failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Cron tick handler: delegates to the guarded `run()`. */
  private runScheduled(): void {
    void this.run();
  }
}
