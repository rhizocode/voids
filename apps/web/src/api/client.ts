/**
 * A small typed `fetch` wrapper for the Voids backend. All requests are rooted
 * at `/api`. Non-2xx responses throw an {@link ApiError}; when the body carries
 * a `{ code, reason }` payload (the backend's standard error shape) those are
 * surfaced on the error so callers can show the reason inline.
 */
import { payloadResultSchema, type PayloadResult } from '@voids/shared';

const BASE = '/api';

/** Error thrown for any non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly reason?: string;

  constructor(status: number, message: string, payload?: PayloadResult) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code;
    this.reason = payload?.reason;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204/empty bodies are valid; only parse JSON when there is content.
  const text = await res.text();
  const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const parsed = payloadResultSchema.safeParse(data);
    const payload = parsed.success ? parsed.data : undefined;
    const message = payload?.reason ?? `${method} ${path} failed (${res.status})`;
    throw new ApiError(res.status, message, payload);
  }

  return data as T;
}

export const get = <T>(path: string): Promise<T> => request<T>('GET', path);
export const post = <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body);
export const put = <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body);
export const del = <T>(path: string): Promise<T> => request<T>('DELETE', path);
