import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import { schema } from '../db/schema';
import type { DbHandle } from '../db/client';
import { DB } from '../db/db.module';
import { SettingsService } from '../config/settings.service';
import { MovieRepository } from '../db/repositories/movie.repository';
import { ServerRepository } from '../db/repositories/server.repository';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { JobRunnerService } from '../search/job-runner.service';
import { SearchService } from '../search/search.service';
import { SearchController } from '../search/search.controller';
import { RssService } from './rss.service';
import { RssController, RssFeedController } from './rss.controller';

function makeHandle(): DbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  return { db, sqlite };
}

const SERVER = 'srv-1';
const LIB = 'lib-1';
const FEED_TOKEN = 'test-feed-token-0000-0000-000000000001';

interface SeedRec {
  title: string;
  year: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  posterUrl: string | null;
  status: string;
}

function seedRec(handle: DbHandle, rec: SeedRec): number {
  const info = handle.sqlite
    .prepare(
      `INSERT INTO recommended_movies
        (server_id, library_key, title, year, tmdb_id, imdb_id, poster_url, status)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(SERVER, LIB, rec.title, rec.year, rec.tmdbId, rec.imdbId, rec.posterUrl, rec.status);
  return Number(info.lastInsertRowid);
}

describe('RSS feed (e2e)', () => {
  let app: INestApplication;
  let handle: DbHandle;
  let newId: number;
  let approvedId: number;
  let settings: SettingsService;

  beforeEach(async () => {
    handle = makeHandle();
    // A library row so /api/rss can resolve a title.
    handle.sqlite
      .prepare(
        'INSERT INTO libraries (server_id, key, title, type, enabled, is_default, feed_token) VALUES (?,?,?,?,?,?,?)',
      )
      .run(SERVER, LIB, 'Movies', 'movie', 1, 1, FEED_TOKEN);

    newId = seedRec(handle, {
      title: 'New Movie',
      year: 2021,
      tmdbId: 1001,
      imdbId: 'tt1001',
      posterUrl: 'https://image.tmdb.org/t/p/w185/new.jpg',
      status: 'new',
    });
    approvedId = seedRec(handle, {
      title: 'Approved Movie',
      year: 2010,
      tmdbId: 1002,
      imdbId: null,
      posterUrl: null,
      status: 'approved',
    });
    seedRec(handle, {
      title: 'Rejected Movie',
      year: 1999,
      tmdbId: 1003,
      imdbId: 'tt1003',
      posterUrl: 'https://image.tmdb.org/t/p/w185/rej.jpg',
      status: 'rejected',
    });
    seedRec(handle, {
      title: 'Ignored Movie',
      year: 2000,
      tmdbId: 1004,
      imdbId: 'tt1004',
      posterUrl: null,
      status: 'ignored',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [RssFeedController, RssController, SearchController],
      providers: [
        RssService,
        SettingsService,
        MovieRepository,
        ServerRepository,
        SearchJobRepository,
        { provide: DB, useValue: handle },
        // SearchController needs these; not exercised by the feed paths under test.
        { provide: JobRunnerService, useValue: {} },
        { provide: SearchService, useValue: {} },
      ],
    }).compile();

    settings = moduleRef.get(SettingsService);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    handle.sqlite.close();
  });

  it('GET /rss/:s/:k returns only approved gaps by default, as JSON', async () => {
    const res = await request(app.getHttpServer()).get(`/rss/${SERVER}/${FEED_TOKEN}`).expect(200);
    expect(res.headers['content-type']).toContain('application/json');

    const titles = res.body.map((i: { title: string }) => i.title);
    expect(titles).toEqual(['Approved Movie']);
  });

  it('GET /rss/:s/:k returns new+approved with exact keys when rssIncludeNew is on', async () => {
    settings.update({ rssIncludeNew: true });
    const res = await request(app.getHttpServer()).get(`/rss/${SERVER}/${FEED_TOKEN}`).expect(200);

    const titles = res.body.map((i: { title: string }) => i.title).sort();
    expect(titles).toEqual(['Approved Movie', 'New Movie']);

    const newItem = res.body.find((i: { title: string }) => i.title === 'New Movie');
    expect(Object.keys(newItem).sort()).toEqual(
      ['imdb_id', 'poster_path', 'release_date', 'title', 'tmdb_id'].sort(),
    );
    expect(newItem).toEqual({
      title: 'New Movie',
      imdb_id: 'tt1001',
      tmdb_id: 1001,
      release_date: 2021,
      poster_path: 'https://image.tmdb.org/t/p/w185/new.jpg',
    });

    // Approved item without imdb/poster: null imdb, empty-string poster.
    const approved = res.body.find((i: { title: string }) => i.title === 'Approved Movie');
    expect(approved.imdb_id).toBeNull();
    expect(approved.poster_path).toBe('');
  });

  it('PATCH /api/recommended/:id changes status and the feed reflects it', async () => {
    // Approve the "new" one (still in feed), reject the approved one (drops out).
    await request(app.getHttpServer())
      .patch(`/api/recommended/${newId}`)
      .send({ status: 'approved' })
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('approved'));

    await request(app.getHttpServer())
      .patch(`/api/recommended/${approvedId}`)
      .send({ status: 'rejected' })
      .expect(200);

    const res = await request(app.getHttpServer()).get(`/rss/${SERVER}/${FEED_TOKEN}`).expect(200);
    const titles = res.body.map((i: { title: string }) => i.title);
    expect(titles).toEqual(['New Movie']);
  });

  it('PATCH /api/recommended/:id 404s for an unknown id', async () => {
    await request(app.getHttpServer())
      .patch('/api/recommended/999999')
      .send({ status: 'approved' })
      .expect(404);
  });

  it('PATCH /api/recommended/:id 400s on an invalid status', async () => {
    await request(app.getHttpServer())
      .patch(`/api/recommended/${newId}`)
      .send({ status: 'bogus' })
      .expect(400);
  });

  it('GET /api/rss lists the feed with the correct count and title', async () => {
    const res = await request(app.getHttpServer()).get('/api/rss').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      serverId: SERVER,
      libraryKey: LIB,
      title: 'Movies',
      url: `/rss/${SERVER}/${FEED_TOKEN}`,
      count: 1,
    });
  });

  it('PATCH bulk updates many recommendations', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/recommended')
      .send({ ids: [newId, approvedId], status: 'ignored' })
      .expect(200);
    expect(res.body.updated).toBe(2);
    const feed = await request(app.getHttpServer()).get(`/rss/${SERVER}/${FEED_TOKEN}`).expect(200);
    expect(feed.body).toHaveLength(0);
  });
});
