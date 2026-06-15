import { sql } from 'drizzle-orm';
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  index,
} from 'drizzle-orm/sqlite-core';

/**
 * Single-row app config. JSON columns hold nested structures (schedule,
 * network timeouts). Notification configs are normalized into
 * `notification_providers`.
 */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tmdbApiKey: text('tmdb_api_key'),
  schedule: text('schedule', { mode: 'json' }),
  movieStatus: integer('movie_status').notNull().default(1),
  authMode: text('auth_mode').notNull().default('none'),
  authUsername: text('auth_username'),
  authPasswordHash: text('auth_password_hash'),
  connectTimeoutMs: integer('connect_timeout_ms').notNull().default(10000),
  readTimeoutMs: integer('read_timeout_ms').notNull().default(60000),
  autoPushRadarr: integer('auto_push_radarr', { mode: 'boolean' }).notNull().default(false),
  radarr: text('radarr', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * A configured media server (Jellyfin / Plex). `id` is the server's own
 * identifier as reported by the source.
 */
export const mediaServers = sqliteTable('media_servers', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name'),
  address: text('address').notNull(),
  port: integer('port').notNull(),
  useHttps: integer('use_https', { mode: 'boolean' }).notNull().default(false),
  token: text('token'),
});

export const libraries = sqliteTable(
  'libraries',
  {
    serverId: text('server_id').notNull(),
    key: text('key').notNull(),
    title: text('title'),
    type: text('type'),
    collectionType: text('collection_type'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    feedToken: text('feed_token'),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.key] })],
);

export const ownedMovies = sqliteTable(
  'owned_movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    serverId: text('server_id').notNull(),
    libraryKey: text('library_key').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id'),
    collectionId: integer('collection_id'),
    collectionTitle: text('collection_title'),
    posterUrl: text('poster_url'),
    backdropUrl: text('backdrop_url'),
    language: text('language').notNull().default('en'),
    overview: text('overview'),
    genres: text('genres', { mode: 'json' }),
    mediaItemId: text('media_item_id'),
    mediaItemKey: text('media_item_key'),
  },
  (t) => [
    index('owned_movies_tmdb_idx').on(t.tmdbId),
    index('owned_movies_imdb_idx').on(t.imdbId),
    index('owned_movies_lib_idx').on(t.serverId, t.libraryKey),
  ],
);

export const recommendedMovies = sqliteTable(
  'recommended_movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    serverId: text('server_id').notNull(),
    libraryKey: text('library_key').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id'),
    collectionId: integer('collection_id'),
    collectionTitle: text('collection_title'),
    posterUrl: text('poster_url'),
    backdropUrl: text('backdrop_url'),
    language: text('language').notNull().default('en'),
    overview: text('overview'),
    genres: text('genres', { mode: 'json' }),
    status: text('status').notNull().default('new'),
    discoveredAt: integer('discovered_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index('recommended_movies_tmdb_idx').on(t.tmdbId),
    index('recommended_movies_lib_idx').on(t.serverId, t.libraryKey),
  ],
);

export const movieCache = sqliteTable('movie_cache', {
  tmdbId: integer('tmdb_id').primaryKey(),
  imdbId: text('imdb_id'),
  title: text('title'),
  year: integer('year'),
  collectionId: integer('collection_id'),
  collectionTitle: text('collection_title'),
  genres: text('genres', { mode: 'json' }),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  releaseStatus: text('release_status'),
  releaseDate: text('release_date'),
  fetchedAt: integer('fetched_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const collectionCache = sqliteTable('collection_cache', {
  collectionId: integer('collection_id').primaryKey(),
  name: text('name'),
  backdropPath: text('backdrop_path'),
  parts: text('parts', { mode: 'json' }),
  fetchedAt: integer('fetched_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const notificationProviders = sqliteTable('notification_providers', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  config: text('config', { mode: 'json' }),
  notificationTypes: text('notification_types', { mode: 'json' }),
});

export const searchJobs = sqliteTable(
  'search_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    serverId: text('server_id'),
    libraryKey: text('library_key'),
    status: text('status').notNull().default('queued'),
    searchedCount: integer('searched_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    error: text('error'),
    cancelRequested: integer('cancel_requested', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('search_jobs_status_idx').on(t.status)],
);

export const schema = {
  settings,
  mediaServers,
  libraries,
  ownedMovies,
  recommendedMovies,
  movieCache,
  collectionCache,
  notificationProviders,
  searchJobs,
};
