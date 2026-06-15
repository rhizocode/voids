import { resolve } from 'node:path';

/** Auth mode for the HTTP API + SPA. `none` = open (trusted LAN, default). */
export type AuthModeEnv = 'none' | 'basic';

/** TLS mode for the HTTP server. `off` = plain HTTP (default). */
export type TlsModeEnv = 'off' | 'on';

/** Resolved, typed runtime environment for the server. */
export interface AppEnv {
  /** Listen port (default 8484). */
  port: number;
  /** Persistent data directory (db, generated TLS certs). */
  dataDir: string;
  /** Resolved SQLite database path. */
  databasePath: string;
  /** Sub-path mount point for reverse-proxy parity (default `/`). */
  baseUrl: string;
  /** TMDB token-bucket sustained rate (requests/second, default 40). */
  tmdbRateLimit: number;
  /** Pino/Nest log level (default `log`). */
  logLevel: string;
  /** Auth mode: `none` (open) or `basic` (HTTP Basic). Default `none`. */
  authMode: AuthModeEnv;
  /** Basic-auth username (default `admin`). Only used when authMode=basic. */
  authUsername: string;
  /**
   * Basic-auth password (plaintext, from env, hashed on boot). `undefined` when
   * unset — in basic mode that means fail-closed (deny all) with a warning.
   * NEVER logged.
   */
  authPassword?: string;
  /** TLS mode: `off` (plain HTTP, default) or `on` (self-signed cert in DATA_DIR). */
  tls: TlsModeEnv;
  /** IANA timezone for cron job scheduling (default `UTC`). Maps to `TZ` env var. */
  timezone: string;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const port = parsePositiveInt(env.PORT, 8484);
  const dataDir = resolve(env.DATA_DIR ?? './data');
  const databasePath = env.DATABASE_PATH
    ? resolve(env.DATABASE_PATH)
    : resolve(dataDir, 'voids.db');
  const baseUrl = env.BASE_URL ?? '/';
  const tmdbRateLimit = parsePositiveInt(env.TMDB_RATE_LIMIT, 40);
  const logLevel = env.LOG_LEVEL ?? 'log';

  const authMode: AuthModeEnv = env.AUTH_MODE === 'basic' ? 'basic' : 'none';
  const authUsername = env.AUTH_USERNAME ?? 'admin';
  // Distinguish "unset" from "empty string" — both are treated as no-password,
  // but we never coerce undefined into a falsy hash silently.
  const authPassword = env.AUTH_PASSWORD ? env.AUTH_PASSWORD : undefined;

  const tls: TlsModeEnv = env.TLS === 'on' ? 'on' : 'off';
  const timezone = env.TZ ?? 'UTC';

  return {
    port,
    dataDir,
    databasePath,
    baseUrl,
    tmdbRateLimit,
    logLevel,
    authMode,
    authUsername,
    authPassword,
    tls,
    timezone,
  };
}
