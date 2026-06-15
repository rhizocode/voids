import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { WS_EVENTS } from '@voids/shared';
import { useJobProgress } from './useJobProgress';

// The polling fallback imports the api client dynamically; stub it so no real
// fetch happens and the test stays deterministic.
vi.mock('../api/client', () => ({
  get: vi.fn().mockResolvedValue({
    id: 1,
    serverId: 's',
    libraryKey: 'k',
    status: 'running',
    searchedCount: 0,
    totalCount: 0,
    startedAt: null,
    finishedAt: null,
    error: null,
  }),
  post: vi.fn().mockResolvedValue(undefined),
}));

/** Minimal controllable WebSocket stand-in. */
class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // Fire open asynchronously like a real socket.
    queueMicrotask(() => this.onopen?.());
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
  emit(event: string, data: unknown) {
    this.onmessage?.({ data: JSON.stringify({ event, data }) });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useJobProgress', () => {
  it('opens a socket and transitions through progress to finished', async () => {
    const { result } = renderHook(() => useJobProgress(1));

    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain('/ws');

    act(() => {
      socket.emit(WS_EVENTS.JOB_PROGRESS, {
        jobId: 1,
        searchedCount: 10,
        totalCount: 100,
      });
    });
    expect(result.current.searchedCount).toBe(10);
    expect(result.current.totalCount).toBe(100);
    expect(result.current.status).toBe('running');

    act(() => {
      socket.emit(WS_EVENTS.JOB_PROGRESS, {
        jobId: 1,
        searchedCount: 20,
        totalCount: 100,
        movie: {
          title: 'Fast Five',
          year: 2011,
          tmdbId: 51497,
          imdbId: null,
          collectionId: 9485,
          collectionTitle: 'Fast Collection',
          posterUrl: null,
          backdropUrl: null,
          language: 'en',
          overview: null,
          genres: [],
          moviesInCollection: [],
          mediaItemId: null,
          mediaItemKey: null,
        },
      });
    });
    expect(result.current.foundCount).toBe(1);
    expect(result.current.lastFoundMovie?.title).toBe('Fast Five');

    act(() => {
      socket.emit(WS_EVENTS.JOB_FINISHED, { jobId: 1, payloadCode: 0, reason: 'Done.' });
    });
    expect(result.current.finished).toBe(true);
    expect(result.current.status).toBe('succeeded');
    expect(result.current.reason).toBe('Done.');
  });

  it('ignores progress for a different jobId', async () => {
    const { result } = renderHook(() => useJobProgress(1));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emit(WS_EVENTS.JOB_PROGRESS, { jobId: 999, searchedCount: 50, totalCount: 100 });
    });
    expect(result.current.searchedCount).toBe(0);
  });

  it('maps payloadCode 1 -> cancelled and 2 -> failed', async () => {
    const { result } = renderHook(() => useJobProgress(1));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].emit(WS_EVENTS.JOB_FINISHED, { jobId: 1, payloadCode: 1 });
    });
    expect(result.current.status).toBe('cancelled');
  });

  it('maps payloadCode 2 -> failed', async () => {
    const { result } = renderHook(() => useJobProgress(1));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].emit(WS_EVENTS.JOB_FINISHED, { jobId: 1, payloadCode: 2 });
    });
    expect(result.current.status).toBe('failed');
  });

  it('maps unknown payloadCode -1 -> failed (not succeeded)', async () => {
    const { result } = renderHook(() => useJobProgress(1));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    act(() => {
      MockWebSocket.instances[0].emit(WS_EVENTS.JOB_FINISHED, { jobId: 1, payloadCode: -1 });
    });
    expect(result.current.status).toBe('failed');
  });

  it('sends a job:cancel envelope over the socket', async () => {
    const { result } = renderHook(() => useJobProgress(7));
    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    const socket = MockWebSocket.instances[0];

    act(() => {
      result.current.cancel();
    });
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toEqual({
      event: WS_EVENTS.JOB_CANCEL,
      data: { jobId: 7 },
    });
  });

  it('does nothing when disabled (jobId null)', async () => {
    renderHook(() => useJobProgress(null));
    // Give microtasks a chance.
    await Promise.resolve();
    expect(MockWebSocket.instances.length).toBe(0);
  });
});
