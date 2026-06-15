import { afterEach, describe, expect, it, vi } from 'vitest';
import { RadarrClient } from './radarr.client';

const CONN = { url: 'http://radarr.test:7878', apiKey: 'SECRET-KEY' };

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RadarrClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('request shape', () => {
    it('listMovies: GET /api/v3/movie with X-Api-Key header, parses fields', async () => {
      const spy = mockFetch(() =>
        jsonResponse([
          { tmdbId: 603, imdbId: 'tt0133093', title: 'The Matrix', year: 1999, hasFile: true, monitored: true },
          { tmdbId: 604, title: 'The Matrix Reloaded', year: 2003 },
        ]),
      );
      const movies = await new RadarrClient().listMovies(CONN);

      expect(spy).toHaveBeenCalledTimes(1);
      const [url, init] = spy.mock.calls[0];
      expect(url).toBe('http://radarr.test:7878/api/v3/movie');
      expect(init?.headers).toMatchObject({ 'X-Api-Key': 'SECRET-KEY', Accept: 'application/json' });

      expect(movies).toEqual([
        { tmdbId: 603, imdbId: 'tt0133093', title: 'The Matrix', year: 1999, hasFile: true, monitored: true },
        { tmdbId: 604, imdbId: null, title: 'The Matrix Reloaded', year: 2003, hasFile: false, monitored: false },
      ]);
    });

    it('getQualityProfiles: GET /api/v3/qualityprofile -> [{id,name}]', async () => {
      const spy = mockFetch(() =>
        jsonResponse([
          { id: 1, name: 'HD-1080p' },
          { id: 2, name: 'Any' },
          { name: 'no-id (dropped)' },
        ]),
      );
      const profiles = await new RadarrClient().getQualityProfiles(CONN);
      expect(spy.mock.calls[0][0]).toBe('http://radarr.test:7878/api/v3/qualityprofile');
      expect(profiles).toEqual([
        { id: 1, name: 'HD-1080p' },
        { id: 2, name: 'Any' },
      ]);
    });

    it('getRootFolders: GET /api/v3/rootfolder -> [{path,...}]', async () => {
      const spy = mockFetch(() =>
        jsonResponse([
          { path: '/movies', freeSpace: 1000 },
          { freeSpace: 5 }, // no path -> dropped
        ]),
      );
      const folders = await new RadarrClient().getRootFolders(CONN);
      expect(spy.mock.calls[0][0]).toBe('http://radarr.test:7878/api/v3/rootfolder');
      expect(folders).toEqual([{ path: '/movies', freeSpace: 1000 }]);
    });

    it('addMovie: POST /api/v3/movie with the v3 body incl. addOptions.searchForMovie', async () => {
      const spy = mockFetch(() => jsonResponse({ id: 10 }, 201));
      const outcome = await new RadarrClient().addMovie(CONN, {
        tmdbId: 603,
        title: 'The Matrix',
        qualityProfileId: 1,
        rootFolderPath: '/movies',
        monitored: true,
        minimumAvailability: 'released',
        searchOnAdd: true,
      });

      expect(outcome).toEqual({ status: 'added' });
      const [url, init] = spy.mock.calls[0];
      expect(url).toBe('http://radarr.test:7878/api/v3/movie');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        'X-Api-Key': 'SECRET-KEY',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init?.body as string)).toEqual({
        tmdbId: 603,
        title: 'The Matrix',
        qualityProfileId: 1,
        rootFolderPath: '/movies',
        monitored: true,
        minimumAvailability: 'released',
        addOptions: { searchForMovie: true },
      });
    });

    it('addMovie: searchOnAdd=false sets addOptions.searchForMovie=false', async () => {
      const spy = mockFetch(() => jsonResponse({ id: 10 }, 201));
      await new RadarrClient().addMovie(CONN, {
        tmdbId: 1,
        title: 'X',
        qualityProfileId: 1,
        rootFolderPath: '/movies',
        monitored: false,
        minimumAvailability: 'announced',
        searchOnAdd: false,
      });
      const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
      expect(body.addOptions).toEqual({ searchForMovie: false });
      expect(body.monitored).toBe(false);
      expect(body.minimumAvailability).toBe('announced');
    });

    it('addMovie: 400 "already been added" -> exists (non-fatal)', async () => {
      mockFetch(
        () =>
          new Response(
            JSON.stringify([{ errorMessage: 'This movie has already been added' }]),
            { status: 400 },
          ),
      );
      const outcome = await new RadarrClient().addMovie(CONN, {
        tmdbId: 603,
        title: 'The Matrix',
        qualityProfileId: 1,
        rootFolderPath: '/movies',
        monitored: true,
        minimumAvailability: 'released',
        searchOnAdd: true,
      });
      expect(outcome).toEqual({ status: 'exists' });
    });

    it('addMovie: other 400 -> failed with sanitized message', async () => {
      mockFetch(
        () =>
          new Response(JSON.stringify([{ errorMessage: 'Invalid quality profile' }]), {
            status: 400,
          }),
      );
      const outcome = await new RadarrClient().addMovie(CONN, {
        tmdbId: 603,
        title: 'The Matrix',
        qualityProfileId: 99,
        rootFolderPath: '/movies',
        monitored: true,
        minimumAvailability: 'released',
        searchOnAdd: true,
      });
      expect(outcome.status).toBe('failed');
      expect(outcome).toMatchObject({ error: expect.stringContaining('Invalid quality profile') });
    });

    it('testConnection: GET /api/v3/system/status, resolves on 200', async () => {
      const spy = mockFetch(() => jsonResponse({ version: '5.0' }));
      await expect(new RadarrClient().testConnection(CONN)).resolves.toBeUndefined();
      expect(spy.mock.calls[0][0]).toBe('http://radarr.test:7878/api/v3/system/status');
    });

    it('tolerates a trailing slash on the base url', async () => {
      const spy = mockFetch(() => jsonResponse([]));
      await new RadarrClient().listMovies({ url: 'http://radarr.test:7878/', apiKey: 'k' });
      expect(spy.mock.calls[0][0]).toBe('http://radarr.test:7878/api/v3/movie');
    });
  });

  describe('graceful degradation', () => {
    it('listMovies: network error -> []', async () => {
      mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));
      expect(await new RadarrClient().listMovies(CONN)).toEqual([]);
    });

    it('listMovies: HTTP 500 -> []', async () => {
      mockFetch(() => jsonResponse({ error: 'boom' }, 500));
      expect(await new RadarrClient().listMovies(CONN)).toEqual([]);
    });

    it('getQualityProfiles / getRootFolders: network error -> []', async () => {
      mockFetch(() => Promise.reject(new Error('down')));
      const c = new RadarrClient();
      expect(await c.getQualityProfiles(CONN)).toEqual([]);
      expect(await c.getRootFolders(CONN)).toEqual([]);
    });

    it('addMovie: network error -> failed (never throws)', async () => {
      mockFetch(() => Promise.reject(new Error('down')));
      const outcome = await new RadarrClient().addMovie(CONN, {
        tmdbId: 1,
        title: 'X',
        qualityProfileId: 1,
        rootFolderPath: '/movies',
        monitored: true,
        minimumAvailability: 'released',
        searchOnAdd: true,
      });
      expect(outcome.status).toBe('failed');
    });

    it('testConnection: network error throws (explicit test endpoint)', async () => {
      mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));
      await expect(new RadarrClient().testConnection(CONN)).rejects.toThrow(/Could not reach Radarr/);
    });

    it('testConnection: non-2xx throws', async () => {
      mockFetch(() => jsonResponse({}, 401));
      await expect(new RadarrClient().testConnection(CONN)).rejects.toThrow(/HTTP 401/);
    });

    it('never includes the api key in thrown error messages', async () => {
      mockFetch(() => Promise.reject(new Error('connection to host failed')));
      await expect(new RadarrClient().testConnection(CONN)).rejects.not.toThrow(/SECRET-KEY/);
    });
  });
});
