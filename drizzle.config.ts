import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './apps/server/src/db/schema.ts',
  out: './apps/server/drizzle',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './data/voids.db',
  },
});
