/**
 * Tracks a background search job's live progress over the `/ws` WebSocket, with
 * a REST polling fallback so the UI stays correct if the socket drops.
 *
 * The server speaks a `{ event, data }` envelope (see `@voids/shared`
 * `WS_EVENTS`). We validate every inbound frame with the shared zod schemas,
 * reconnect with capped exponential backoff, and stop all activity once the job
 * reaches a terminal status. `cancel()` sends `job:cancel` over the socket and
 * also hits the REST cancel endpoint as a belt-and-braces fallback.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  WS_EVENTS,
  jobProgressEventSchema,
  jobFinishedEventSchema,
  wsEnvelopeSchema,
  searchJobSchema,
  type Movie,
  type SearchJob,
  type SearchJobStatus,
} from '@voids/shared';
import { get, post } from '../api/client';

/** The live, merged view of a job the UI renders. */
export interface JobProgressState {
  jobId: number | null;
  status: SearchJobStatus | 'idle';
  searchedCount: number;
  totalCount: number;
  /** Count of gaps observed live over the socket this session. */
  foundCount: number;
  /** Most recently found gap, for a live ticker. */
  lastFoundMovie: Movie | null;
  /** Terminal payload reason from `job:finished` (or polled error). */
  reason: string | null;
  /** True once a terminal status has been reached. */
  finished: boolean;
}

const TERMINAL: ReadonlySet<SearchJobStatus> = new Set([
  'succeeded',
  'failed',
  'cancelled',
]);

function payloadCodeToStatus(code: number): SearchJobStatus {
  // payloadCode 0=success, 1=cancelled, 2=failed (per brief §9 / WS contract).
  if (code === 0) return 'succeeded';
  if (code === 1) return 'cancelled';
  return 'failed';
}

type Action =
  | { type: 'reset'; jobId: number | null }
  | { type: 'progress'; searchedCount: number; totalCount: number; movie?: Movie }
  | { type: 'finished'; status: SearchJobStatus; reason?: string }
  | { type: 'poll'; job: SearchJob };

function initialState(jobId: number | null): JobProgressState {
  return {
    jobId,
    status: jobId == null ? 'idle' : 'running',
    searchedCount: 0,
    totalCount: 0,
    foundCount: 0,
    lastFoundMovie: null,
    reason: null,
    finished: false,
  };
}

function reducer(state: JobProgressState, action: Action): JobProgressState {
  switch (action.type) {
    case 'reset':
      return initialState(action.jobId);
    case 'progress': {
      if (state.finished) return state;
      return {
        ...state,
        status: 'running',
        // Counts only move forward; a stale frame must never regress the bar.
        searchedCount: Math.max(state.searchedCount, action.searchedCount),
        totalCount: Math.max(state.totalCount, action.totalCount),
        foundCount: action.movie ? state.foundCount + 1 : state.foundCount,
        lastFoundMovie: action.movie ?? state.lastFoundMovie,
      };
    }
    case 'finished':
      return {
        ...state,
        status: action.status,
        reason: action.reason ?? state.reason,
        finished: true,
      };
    case 'poll': {
      const { job } = action;
      const isTerminal = TERMINAL.has(job.status);
      return {
        ...state,
        // Merge whichever source is further along.
        status: state.finished ? state.status : job.status,
        searchedCount: Math.max(state.searchedCount, job.searchedCount),
        totalCount: Math.max(state.totalCount, job.totalCount),
        reason: state.reason ?? job.error,
        finished: state.finished || isTerminal,
      };
    }
    default:
      return state;
  }
}

const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 15000;

/** Derive the `/ws` URL from the current location, honoring the dev proxy + BASE_URL. */
function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // import.meta.env.BASE_URL is '/' by default; trim trailing slash for join.
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${proto}//${window.location.host}${base}/ws`;
}

export interface UseJobProgress extends JobProgressState {
  cancel: () => void;
}

/**
 * Subscribe to a job's progress. Pass `null` to disable (no socket, no polling).
 * Resets cleanly whenever `jobId` changes.
 */
export function useJobProgress(jobId: number | null): UseJobProgress {
  const [state, dispatch] = useReducer(reducer, jobId, initialState);

  const socketRef = useRef<WebSocket | null>(null);
  const finishedRef = useRef(false);
  // Keep a ref of the active jobId so socket callbacks read the latest value.
  const jobIdRef = useRef(jobId);
  jobIdRef.current = jobId;
  finishedRef.current = state.finished;

  // Reset state whenever the tracked job changes.
  useEffect(() => {
    dispatch({ type: 'reset', jobId });
  }, [jobId]);

  // WebSocket connection with reconnect backoff.
  useEffect(() => {
    if (jobId == null) return;

    let closed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (closed) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
      };

      socket.onmessage = (ev: MessageEvent) => {
        let raw: unknown;
        try {
          raw = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        } catch {
          return;
        }
        const envelope = wsEnvelopeSchema.safeParse(raw);
        if (!envelope.success) return;
        const { event, data } = envelope.data;

        if (event === WS_EVENTS.JOB_PROGRESS) {
          const parsed = jobProgressEventSchema.safeParse(data);
          if (!parsed.success || parsed.data.jobId !== jobIdRef.current) return;
          dispatch({
            type: 'progress',
            searchedCount: parsed.data.searchedCount,
            totalCount: parsed.data.totalCount,
            movie: parsed.data.movie,
          });
        } else if (event === WS_EVENTS.JOB_FINISHED) {
          const parsed = jobFinishedEventSchema.safeParse(data);
          if (!parsed.success || parsed.data.jobId !== jobIdRef.current) return;
          dispatch({
            type: 'finished',
            status: payloadCodeToStatus(parsed.data.payloadCode),
            reason: parsed.data.reason,
          });
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        // Don't reconnect once the job is done — the socket is purely a live accelerant.
        if (!finishedRef.current) scheduleReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    function scheduleReconnect() {
      if (closed || finishedRef.current) return;
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const s = socketRef.current;
      socketRef.current = null;
      if (s) {
        s.onopen = s.onmessage = s.onclose = s.onerror = null;
        s.close();
      }
    };
  }, [jobId]);

  // Polling fallback: only runs when the socket is NOT open, so it's a true
  // fallback rather than double-work alongside a healthy WebSocket.
  useEffect(() => {
    if (jobId == null || state.finished) return;
    let cancelledPoll = false;

    async function poll() {
      // Skip this tick while the socket is healthy — let it drive updates.
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const raw = await get<unknown>(`/search/${jobId}`);
        const parsed = searchJobSchema.safeParse(raw);
        // A malformed body can't be trusted; stop the poller to avoid leaking.
        if (!parsed.success) { cancelledPoll = true; clearInterval(timer); return; }
        if (!cancelledPoll) dispatch({ type: 'poll', job: parsed.data });
      } catch {
        // Network blip — the interval will retry.
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    // Kick once immediately so a finished prior job is reflected fast.
    void poll();

    return () => {
      cancelledPoll = true;
      clearInterval(timer);
    };
  }, [jobId, state.finished]);

  const cancel = useCallback(() => {
    const id = jobIdRef.current;
    if (id == null) return;
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event: WS_EVENTS.JOB_CANCEL, data: { jobId: id } }));
    }
    // REST fallback so cancellation lands even if the socket is down.
    void post(`/search/${id}/cancel`).catch(() => {});
  }, []);

  return { ...state, cancel };
}
