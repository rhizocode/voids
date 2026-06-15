import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MediaLibrary, MediaServer } from '@voids/shared';
import { SearchAllTask } from './search-all.task';

const SRV_A: MediaServer = {
  id: 'srv-a',
  type: 'jellyfin',
  name: 'Server A',
  address: '10.0.0.1',
  port: 8096,
  useHttps: false,
  token: 'tok-a',
};
const SRV_B: MediaServer = { ...SRV_A, id: 'srv-b', name: 'Server B' };

const libEnabled = (serverId: string, key: string): MediaLibrary => ({
  serverId,
  key,
  title: `Movies ${key}`,
  type: 'movie',
  collectionType: 'movies',
  enabled: true,
  isDefault: true,
});

function makeTask(overrides: {
  servers?: MediaServer[];
  libsByServer?: Record<string, MediaLibrary[]>;
  testConnection?: ReturnType<typeof vi.fn>;
  listLibraries?: ReturnType<typeof vi.fn>;
  scan?: ReturnType<typeof vi.fn>;
}) {
  const servers = overrides.servers ?? [SRV_A];
  const libsByServer = overrides.libsByServer ?? { 'srv-a': [libEnabled('srv-a', 'lib-1')] };

  const repo = {
    listServers: vi.fn(() => servers),
    listLibraries: vi.fn((id: string) => libsByServer[id] ?? []),
    findLibrary: vi.fn(() => undefined),
    upsertLibrary: vi.fn(),
  };
  const source = {
    type: 'jellyfin' as const,
    testConnection: overrides.testConnection ?? vi.fn().mockResolvedValue({ id: 'x', name: 'x', version: '1' }),
    listLibraries: overrides.listLibraries ?? vi.fn().mockResolvedValue([]),
    listMovies: vi.fn().mockResolvedValue([]),
  };
  const registry = { get: vi.fn(() => source) };
  const settings = {
    get: () => ({ connectTimeoutMs: 1000, readTimeoutMs: 1000, autoPushRadarr: false }),
  };
  const library = { scan: overrides.scan ?? vi.fn().mockResolvedValue(3) };
  const runner = { enqueue: vi.fn((_s: string, _l: string) => 42) };
  const notify = vi.fn().mockResolvedValue(undefined);
  const notifications = { notify };

  const task = new SearchAllTask(
    repo as never,
    registry as never,
    settings as never,
    library as never,
    runner as never,
    notifications as never,
  );
  return { task, repo, source, library, runner, notify };
}

describe('SearchAllTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('happy path: tests connection, refreshes libraries, scans, enqueues per enabled library', async () => {
    const ctx = makeTask({
      libsByServer: { 'srv-a': [libEnabled('srv-a', 'lib-1'), libEnabled('srv-a', 'lib-2')] },
    });
    await ctx.task.run();

    expect(ctx.source.testConnection).toHaveBeenCalledTimes(1);
    expect(ctx.source.listLibraries).toHaveBeenCalledTimes(1);
    expect(ctx.library.scan).toHaveBeenCalledTimes(2);
    expect(ctx.library.scan).toHaveBeenCalledWith('srv-a', 'lib-1');
    expect(ctx.library.scan).toHaveBeenCalledWith('srv-a', 'lib-2');
    expect(ctx.runner.enqueue).toHaveBeenCalledTimes(2);

    // Notifications fired for connection, library update, and per-library scan.
    const types = ctx.notify.mock.calls.map((c) => c[0]);
    expect(types).toContain('PLEX_SERVER_CONNECTION');
    expect(types).toContain('PLEX_LIBRARY_UPDATE');
    expect(types).toContain('PLEX_METADATA_UPDATE');
  });

  it('skips a server whose connection fails and notifies, without scanning it', async () => {
    const ctx = makeTask({
      testConnection: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    await ctx.task.run();

    expect(ctx.library.scan).not.toHaveBeenCalled();
    expect(ctx.runner.enqueue).not.toHaveBeenCalled();
    const failure = ctx.notify.mock.calls.find(
      (c) => c[0] === 'PLEX_SERVER_CONNECTION' && c[1] === 'error',
    );
    expect(failure).toBeDefined();
  });

  it('resilience: one server failing does not abort the others', async () => {
    const connection = vi
      .fn()
      .mockRejectedValueOnce(new Error('down')) // srv-a fails
      .mockResolvedValue({ id: 'x', name: 'x', version: '1' }); // srv-b ok
    const ctx = makeTask({
      servers: [SRV_A, SRV_B],
      libsByServer: {
        'srv-a': [libEnabled('srv-a', 'lib-1')],
        'srv-b': [libEnabled('srv-b', 'lib-9')],
      },
      testConnection: connection,
    });
    await ctx.task.run();

    // srv-a skipped (no scan for lib-1), srv-b still processed (scan + enqueue).
    expect(ctx.library.scan).toHaveBeenCalledTimes(1);
    expect(ctx.library.scan).toHaveBeenCalledWith('srv-b', 'lib-9');
    expect(ctx.runner.enqueue).toHaveBeenCalledTimes(1);
    expect(ctx.runner.enqueue).toHaveBeenCalledWith('srv-b', 'lib-9');
  });

  it('resilience: a library scan failure does not stop other libraries', async () => {
    const scan = vi
      .fn()
      .mockRejectedValueOnce(new Error('scan boom')) // lib-1 fails
      .mockResolvedValue(5); // lib-2 ok
    const ctx = makeTask({
      libsByServer: { 'srv-a': [libEnabled('srv-a', 'lib-1'), libEnabled('srv-a', 'lib-2')] },
      scan,
    });
    await ctx.task.run();

    expect(ctx.library.scan).toHaveBeenCalledTimes(2);
    // Only the successful library is enqueued.
    expect(ctx.runner.enqueue).toHaveBeenCalledTimes(1);
    expect(ctx.runner.enqueue).toHaveBeenCalledWith('srv-a', 'lib-2');
  });

  it('only enqueues for ENABLED libraries', async () => {
    const disabled = { ...libEnabled('srv-a', 'lib-off'), enabled: false };
    const ctx = makeTask({
      libsByServer: { 'srv-a': [disabled, libEnabled('srv-a', 'lib-on')] },
    });
    await ctx.task.run();

    expect(ctx.runner.enqueue).toHaveBeenCalledTimes(1);
    expect(ctx.runner.enqueue).toHaveBeenCalledWith('srv-a', 'lib-on');
  });
});
