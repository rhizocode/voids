import { resolve } from 'node:path';

/** Resolved, typed runtime environment for the server. */
export interface AppEnv {
  port: number;
  dataDir: string;
  databasePath: string;
  baseUrl: string;
  /** TMDB token-bucket sustained rate (requests/second). */
  tmdbRateLimit: number;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const port = Number.parseInt(env.PORT ?? '8484', 10);
  const dataDir = resolve(env.DATA_DIR ?? './data');
  const databasePath = env.DATABASE_PATH
    ? resolve(env.DATABASE_PATH)
    : resolve(dataDir, 'voids.db');
  const baseUrl = env.BASE_URL ?? '/';
  const parsedRate = Number.parseInt(env.TMDB_RATE_LIMIT ?? '40', 10);
  const tmdbRateLimit = Number.isNaN(parsedRate) || parsedRate <= 0 ? 40 : parsedRate;
  return { port, dataDir, databasePath, baseUrl, tmdbRateLimit };
}
