import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ScheduleConfig } from '@voids/shared';
import { SchedulerService, SEARCH_ALL_JOB } from './scheduler.service';
import { SearchAllTask } from './search-all.task';

/** A minimal fake SchedulerRegistry tracking the single dynamic cron job. */
class FakeRegistry {
  jobs = new Map<string, { start: () => void; stop: () => void }>();
  addCronJob = vi.fn((name: string, job: { start: () => void; stop: () => void }) => {
    this.jobs.set(name, job);
  });
  deleteCronJob = vi.fn((name: string) => {
    this.jobs.delete(name);
  });
  getCronJob = vi.fn((name: string) => {
    const job = this.jobs.get(name);
    if (!job) throw new Error('no such job');
    return job;
  });
  doesExist = vi.fn((_type: string, name: string) => this.jobs.has(name));
}

const searchAll = { run: vi.fn().mockResolvedValue(undefined) } as unknown as SearchAllTask;

const PRESET_ENABLED: ScheduleConfig = {
  enabled: true,
  mode: 'preset',
  presetId: 1,
  cron: '0 0 4 * * ?',
};
const DISABLED: ScheduleConfig = { ...PRESET_ENABLED, enabled: false };

describe('SchedulerService', () => {
  let registry: FakeRegistry;

  beforeEach(() => {
    registry = new FakeRegistry();
    vi.clearAllMocks();
  });

  function build(schedule: ScheduleConfig): SchedulerService {
    return new SchedulerService(
      registry as never,
      { get: () => ({ schedule }) } as never,
      searchAll,
    );
  }

  it('registers the cron job on boot when enabled', () => {
    const svc = build(PRESET_ENABLED);
    svc.onApplicationBootstrap();
    expect(registry.addCronJob).toHaveBeenCalledTimes(1);
    expect(registry.addCronJob.mock.calls[0][0]).toBe(SEARCH_ALL_JOB);
    expect(registry.jobs.has(SEARCH_ALL_JOB)).toBe(true);
  });

  it('does not register when disabled', () => {
    const svc = build(DISABLED);
    svc.onApplicationBootstrap();
    expect(registry.addCronJob).not.toHaveBeenCalled();
    expect(registry.jobs.has(SEARCH_ALL_JOB)).toBe(false);
  });

  it('reschedule removes the old job and registers a new one (idempotent)', () => {
    const svc = build(PRESET_ENABLED);
    svc.onApplicationBootstrap();
    expect(registry.addCronJob).toHaveBeenCalledTimes(1);

    svc.reschedule();
    // The existing job is removed before re-adding.
    expect(registry.deleteCronJob).toHaveBeenCalledWith(SEARCH_ALL_JOB);
    expect(registry.addCronJob).toHaveBeenCalledTimes(2);
    expect(registry.jobs.has(SEARCH_ALL_JOB)).toBe(true);
  });

  it('reschedule to disabled removes the job and leaves none', () => {
    const svc = build(PRESET_ENABLED);
    svc.onApplicationBootstrap();
    expect(registry.jobs.has(SEARCH_ALL_JOB)).toBe(true);

    // Swap settings to disabled and reschedule via a fresh service over the
    // same registry (simulating a settings change).
    const disabledSvc = build(DISABLED);
    disabledSvc.reschedule();
    expect(registry.deleteCronJob).toHaveBeenCalledWith(SEARCH_ALL_JOB);
    expect(registry.jobs.has(SEARCH_ALL_JOB)).toBe(false);
  });

  it('reschedule is safe when no job exists', () => {
    const svc = build(DISABLED);
    expect(() => svc.reschedule()).not.toThrow();
    expect(registry.deleteCronJob).not.toHaveBeenCalled();
  });

  it('skips registration on invalid cron without throwing', () => {
    const bad: ScheduleConfig = {
      enabled: true,
      mode: 'custom',
      presetId: null,
      cron: 'not a cron',
    };
    const svc = build(bad);
    expect(() => svc.onApplicationBootstrap()).not.toThrow();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it('a registered job tick invokes SearchAllTask.run', async () => {
    const svc = build(PRESET_ENABLED);
    svc.onApplicationBootstrap();
    // The registered object is a real CronJob; fire its tick and assert the
    // task runs.
    const job = registry.jobs.get(SEARCH_ALL_JOB) as unknown as {
      fireOnTick: () => Promise<void> | void;
    };
    expect(job).toBeDefined();
    await job.fireOnTick();
    expect((searchAll as unknown as { run: ReturnType<typeof vi.fn> }).run).toHaveBeenCalled();
  });
});
