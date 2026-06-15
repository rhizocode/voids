import { describe, expect, it, vi } from 'vitest';
import type { RadarrConfig, RecommendedMovie } from '@voids/shared';
import { RadarrService } from './radarr.service';
import type { RadarrAddOutcome } from './radarr.client';

const FULL_CONFIG: RadarrConfig = {
  url: 'http://radarr.test:7878',
  apiKey: 'k',
  qualityProfileId: 1,
  rootFolderPath: '/movies',
  monitored: true,
  minimumAvailability: 'released',
  searchOnAdd: true,
};

function rec(partial: Partial<RecommendedMovie> & { title: string }): RecommendedMovie {
  return {
    id: partial.id ?? 1,
    status: 'approved',
    discoveredAt: 0,
    title: partial.title,
    year: partial.year ?? 2000,
    tmdbId: partial.tmdbId ?? null,
    imdbId: null,
    collectionId: null,
    collectionTitle: null,
    posterUrl: null,
    backdropUrl: null,
    language: 'en',
    overview: null,
    genres: [],
    moviesInCollection: [],
    mediaItemId: null,
    mediaItemKey: null,
  };
}

function makeService(opts: {
  radarr: RadarrConfig | null;
  approved?: RecommendedMovie[];
  addOutcomes?: RadarrAddOutcome[];
}) {
  const settings = {
    get: () => ({ radarr: opts.radarr, readTimeoutMs: 1000 }),
  };
  const movies = {
    listRecommendedByStatus: vi.fn(() => opts.approved ?? []),
  };
  const outcomes = [...(opts.addOutcomes ?? [])];
  const addMovie = vi.fn(async (): Promise<RadarrAddOutcome> => outcomes.shift() ?? { status: 'added' });
  const listMovies = vi.fn(async () => []);
  const client = { addMovie, listMovies, testConnection: vi.fn(), getQualityProfiles: vi.fn(async () => []), getRootFolders: vi.fn(async () => []) };
  return {
    service: new RadarrService(settings as never, movies as never, client as never),
    addMovie,
    listMovies,
    listRecommendedByStatus: movies.listRecommendedByStatus,
  };
}

describe('RadarrService.pushApproved', () => {
  it('returns configured:false and pushes nothing when Radarr is unconfigured', async () => {
    const { service, addMovie, listRecommendedByStatus } = makeService({ radarr: null });
    const res = await service.pushApproved('s', 'l');
    expect(res).toEqual({ configured: false, results: [] });
    expect(addMovie).not.toHaveBeenCalled();
    expect(listRecommendedByStatus).not.toHaveBeenCalled();
  });

  it('treats config with empty url/apiKey as unconfigured', async () => {
    const { service } = makeService({ radarr: { ...FULL_CONFIG, apiKey: '' } });
    expect(await service.pushApproved('s', 'l')).toEqual({ configured: false, results: [] });
  });

  it('classifies added / exists / failed per movie', async () => {
    const { service, addMovie } = makeService({
      radarr: FULL_CONFIG,
      approved: [
        rec({ id: 1, title: 'Added', tmdbId: 1 }),
        rec({ id: 2, title: 'Exists', tmdbId: 2 }),
        rec({ id: 3, title: 'Failed', tmdbId: 3 }),
      ],
      addOutcomes: [
        { status: 'added' },
        { status: 'exists' },
        { status: 'failed', error: 'HTTP 500' },
      ],
    });
    const res = await service.pushApproved('s', 'l');
    expect(res.configured).toBe(true);
    expect(res.results).toEqual([
      { tmdbId: 1, title: 'Added', status: 'added' },
      { tmdbId: 2, title: 'Exists', status: 'exists' },
      { tmdbId: 3, title: 'Failed', status: 'failed', error: 'HTTP 500' },
    ]);
    expect(addMovie).toHaveBeenCalledTimes(3);
    // Verify defaults are forwarded from config.
    expect(addMovie).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tmdbId: 1,
        qualityProfileId: 1,
        rootFolderPath: '/movies',
        monitored: true,
        minimumAvailability: 'released',
        searchOnAdd: true,
      }),
    );
  });

  it('fails a recommendation with no tmdbId without calling Radarr', async () => {
    const { service, addMovie } = makeService({
      radarr: FULL_CONFIG,
      approved: [rec({ id: 1, title: 'No TMDB', tmdbId: null })],
    });
    const res = await service.pushApproved('s', 'l');
    expect(res.results[0]).toMatchObject({ status: 'failed', tmdbId: null });
    expect(addMovie).not.toHaveBeenCalled();
  });

  it('fails when quality profile / root folder are not configured', async () => {
    const { service, addMovie } = makeService({
      radarr: { ...FULL_CONFIG, qualityProfileId: null, rootFolderPath: null },
      approved: [rec({ id: 1, title: 'X', tmdbId: 5 })],
    });
    const res = await service.pushApproved('s', 'l');
    expect(res.results[0].status).toBe('failed');
    expect(addMovie).not.toHaveBeenCalled();
  });

  it('short-circuits remaining movies after a transport failure', async () => {
    const { service, addMovie } = makeService({
      radarr: FULL_CONFIG,
      approved: [
        rec({ id: 1, title: 'First', tmdbId: 1 }),
        rec({ id: 2, title: 'Second', tmdbId: 2 }),
        rec({ id: 3, title: 'Third', tmdbId: 3 }),
      ],
      addOutcomes: [
        { status: 'failed', error: 'The operation was aborted', transport: true },
      ],
    });
    const res = await service.pushApproved('s', 'l');
    expect(res.configured).toBe(true);
    // Only one real addMovie call — the rest were skipped
    expect(addMovie).toHaveBeenCalledTimes(1);
    expect(res.results).toHaveLength(3);
    expect(res.results[0]).toMatchObject({ tmdbId: 1, title: 'First', status: 'failed' });
    expect(res.results[1]).toMatchObject({ tmdbId: 2, title: 'Second', status: 'failed' });
    expect(res.results[2]).toMatchObject({ tmdbId: 3, title: 'Third', status: 'failed' });
  });

  it('does not short-circuit after a business (HTTP) failure', async () => {
    const { service, addMovie } = makeService({
      radarr: FULL_CONFIG,
      approved: [
        rec({ id: 1, title: 'First', tmdbId: 1 }),
        rec({ id: 2, title: 'Second', tmdbId: 2 }),
      ],
      addOutcomes: [
        { status: 'failed', error: 'HTTP 422: invalid quality' },
        { status: 'added' },
      ],
    });
    const res = await service.pushApproved('s', 'l');
    expect(addMovie).toHaveBeenCalledTimes(2);
    expect(res.results[0]).toMatchObject({ status: 'failed' });
    expect(res.results[1]).toMatchObject({ status: 'added' });
  });

  it('getMovies returns [] when unconfigured', async () => {
    const { service, listMovies } = makeService({ radarr: null });
    expect(await service.getMovies()).toEqual([]);
    expect(listMovies).not.toHaveBeenCalled();
  });
});
