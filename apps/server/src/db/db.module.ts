import { join } from 'node:path';
import {
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb, type DbHandle } from './client';
import { loadEnv } from '../config/env';

export const DB = Symbol('VOIDS_DB');

const dbProvider = {
  provide: DB,
  useFactory: (): DbHandle => {
    const env = loadEnv();
    return createDb(env.databasePath);
  },
};

@Global()
@Module({
  providers: [dbProvider],
  exports: [DB],
})
export class DbModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DbModule.name);

  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  onModuleInit(): void {
    // Migrations live alongside the built server; resolve relative to this file
    // so it works both from src (dev/test) and dist (production).
    const migrationsFolder = join(__dirname, '..', '..', 'drizzle');
    try {
      migrate(this.handle.db, { migrationsFolder });
      this.logger.log(`Applied migrations from ${migrationsFolder}`);
    } catch (err) {
      this.logger.error(`Failed to apply migrations from ${migrationsFolder}`, err as Error);
      throw err;
    }
  }

  onApplicationShutdown(): void {
    this.handle.sqlite.close();
  }
}
