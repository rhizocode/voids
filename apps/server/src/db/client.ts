import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from './schema';

export type VoidsDb = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
  db: VoidsDb;
  sqlite: Database.Database;
}

/** Open (creating its directory if needed) the SQLite database at `databasePath`. */
export function createDb(databasePath: string): DbHandle {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
