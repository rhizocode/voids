import { describe, it, expect } from 'vitest';
import type { RecommendedMovie } from '@voids/shared';
import { rssItemSchema } from '@voids/shared';
import { RssService } from './rss.service';

function makeRec(overrides: Partial<RecommendedMovie>): RecommendedMovie {
  return {
    id: 1,
    status: 'new',
    discoveredAt: 0,
    title: 'The Matrix Reloaded',
    year: 2003,
    tmdbId: 604,
    imdbId: 'tt0234215',
    collectionId: 2344,
    collectionTitle: 'The Matrix Collection',
    posterUrl: 'https://image.tmdb.org/t/p/w185/abc.jpg',
    backdropUrl: null,
    language: 'en',
    overview: null,
    genres: [],
    moviesInCollection: [],
    mediaItemId: null,
    mediaItemKey: null,
    ...overrides,
  };
}

describe('RssService.toRssItem (serialization)', () => {
  it('emits the EXACT snake_case keys from gaps-reference §5', () => {
    const item = RssService.toRssItem(makeRec({}));
    // Exact key set, no camelCase leakage.
    expect(Object.keys(item).sort()).toEqual(
      ['imdb_id', 'poster_path', 'release_date', 'title', 'tmdb_id'].sort(),
    );
    // Value formats: release_date is the YEAR as an integer.
    expect(item).toEqual({
      title: 'The Matrix Reloaded',
      imdb_id: 'tt0234215',
      tmdb_id: 604,
      release_date: 2003,
      poster_path: 'https://image.tmdb.org/t/p/w185/abc.jpg',
    });
    expect(typeof item.release_date).toBe('number');
    // Validates against the shared RssItem schema.
    expect(rssItemSchema.parse(item)).toEqual(item);
  });

  it('maps a movie WITHOUT imdb_id to null', () => {
    const item = RssService.toRssItem(makeRec({ imdbId: null }));
    expect(item.imdb_id).toBeNull();
    expect(rssItemSchema.parse(item)).toBeTruthy();
  });

  it('maps a movie WITHOUT a poster to an empty string (quirk #7)', () => {
    const item = RssService.toRssItem(makeRec({ posterUrl: null }));
    expect(item.poster_path).toBe('');
  });

  it('maps a movie WITHOUT a year to null release_date', () => {
    const item = RssService.toRssItem(makeRec({ year: null }));
    expect(item.release_date).toBeNull();
  });
});
