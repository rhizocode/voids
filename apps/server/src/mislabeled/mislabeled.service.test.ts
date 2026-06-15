import { describe, expect, it, vi } from 'vitest';
import type { Movie } from '@voids/shared';
import { MislabeledService } from './mislabeled.service';

function owned(partial: Partial<Movie> & { title: string }): Movie {
  return {
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

function makeService(ownedMovies: Movie[], tmdbTitles: Record<number, string>) {
  const movies = { listOwned: vi.fn(() => ownedMovies) };
  const getMovie = vi.fn(async (id: number) => {
    if (!(id in tmdbTitles)) throw new Error(`no tmdb ${id}`);
    return { id, title: tmdbTitles[id] };
  });
  const tmdb = { getMovie };
  return {
    service: new MislabeledService(movies as never, tmdb as never),
    getMovie,
  };
}

describe('MislabeledService', () => {
  it('flags movies whose title distance exceeds the threshold, sorted desc', async () => {
    const ownedMovies = [
      owned({ title: 'The Matrix', tmdbId: 603, year: 1999 }), // exact -> distance 0
      owned({ title: 'Avengers', tmdbId: 24428, year: 2012 }), // vs "The Avengers" -> 4
      owned({ title: 'The Matrixx', tmdbId: 604, year: 2003 }), // vs "The Matrix Reloaded" -> larger
    ];
    const tmdbTitles = {
      603: 'The Matrix',
      24428: 'The Avengers',
      604: 'The Matrix Reloaded',
    };
    const { service } = makeService(ownedMovies, tmdbTitles);

    const flagged = await service.detect('s', 'l', 3);
    // 603 is exact (excluded). Both others exceed threshold 3, sorted by distance desc.
    expect(flagged.map((f) => f.tmdbId)).toEqual([604, 24428]);
    expect(flagged[0].distance).toBeGreaterThan(flagged[1].distance);
    expect(flagged[1]).toMatchObject({
      ownedTitle: 'Avengers',
      tmdbTitle: 'The Avengers',
      year: 2012,
      tmdbId: 24428,
      distance: 4,
    });
  });

  it('honors the threshold (higher threshold flags fewer)', async () => {
    const ownedMovies = [owned({ title: 'Avengers', tmdbId: 24428, year: 2012 })];
    const tmdbTitles = { 24428: 'The Avengers' }; // distance 4
    const { service } = makeService(ownedMovies, tmdbTitles);

    expect((await service.detect('s', 'l', 3)).map((f) => f.tmdbId)).toEqual([24428]);
    expect(await service.detect('s', 'l', 4)).toEqual([]); // distance not > 4
    expect(await service.detect('s', 'l', 10)).toEqual([]);
  });

  it('skips owned movies without a tmdbId (no TMDB lookup)', async () => {
    const ownedMovies = [owned({ title: 'Mystery Film', tmdbId: null })];
    const { service, getMovie } = makeService(ownedMovies, {});
    expect(await service.detect('s', 'l', 0)).toEqual([]);
    expect(getMovie).not.toHaveBeenCalled();
  });

  it('skips (does not abort) a movie whose TMDB lookup fails', async () => {
    const ownedMovies = [
      owned({ title: 'Broken', tmdbId: 111 }), // lookup throws
      owned({ title: 'Avengers', tmdbId: 24428, year: 2012 }),
    ];
    const tmdbTitles = { 24428: 'The Avengers' };
    const { service } = makeService(ownedMovies, tmdbTitles);
    const flagged = await service.detect('s', 'l', 3);
    expect(flagged.map((f) => f.tmdbId)).toEqual([24428]);
  });
});
