import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobRunnerService } from './job-runner.service';

function makeService(opts: { initialStatus?: string } = {}) {
  let status = opts.initialStatus ?? 'running';
  const jobs = {
    create: vi.fn(() => 1),
    find: vi.fn(() => ({ id: 1, status, serverId: 's', libraryKey: 'l' })),
    update: vi.fn(),
    failStale: vi.fn(() => 0),
    requestCancel: vi.fn(() => { status = 'cancelled'; }),
  };
  const search = { runSearch: vi.fn(() => new Promise(() => {})) }; // never resolves
  const svc = new JobRunnerService(jobs as never, search as never);
  return { svc, jobs, search };
}

describe('JobRunnerService.enqueueAndWait', () => {
  beforeEach(() => vi.useFakeTimers());

  it('requests cancellation and returns cancelled on timeout', async () => {
    const { svc, jobs } = makeService({ initialStatus: 'running' });

    const promise = svc.enqueueAndWait('srv', 'lib', { pollMs: 10, timeoutMs: 50 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(jobs.requestCancel).toHaveBeenCalledWith(1);
    expect(result).toEqual({ jobId: 1, status: 'cancelled' });
  });

  it('resolves immediately when job reaches terminal status without timing out', async () => {
    const jobs = {
      create: vi.fn(() => 2),
      find: vi.fn(() => ({ id: 2, status: 'succeeded', serverId: 's', libraryKey: 'l' })),
      update: vi.fn(),
      failStale: vi.fn(() => 0),
      requestCancel: vi.fn(),
    };
    const search = { runSearch: vi.fn().mockResolvedValue(undefined) };
    const svc = new JobRunnerService(jobs as never, search as never);

    const promise = svc.enqueueAndWait('srv', 'lib', { pollMs: 10, timeoutMs: 5000 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(jobs.requestCancel).not.toHaveBeenCalled();
    expect(result).toEqual({ jobId: 2, status: 'succeeded' });
  });
});
