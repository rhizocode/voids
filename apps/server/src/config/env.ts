import { resolve } from 'node:path';

/** Resolved, typed runtime environment for the server. */
export interface AppEnv {
  port: number;
  dataDir: string;
  databasePath: string;
  baseUrl: string;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const port = Number.parseInt(env.PORT ?? '8484', 10);
  const dataDir = resolve(env.DATA_DIR ?? './data');
  const databasePath = env.DATABASE_PATH
    ? resolve(env.DATABASE_PATH)
    : resolve(dataDir, 'voids.db');
  const baseUrl = env.BASE_URL ?? '/';
  return { port, dataDir, databasePath, baseUrl };
}
