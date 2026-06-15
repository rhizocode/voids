import { describe, it, expect } from 'vitest';
import { movieKey, normalizeTitle, type Movie } from './movie';

function make(partial: Partial<Movie>): Movie {
  return {
    title: 'Untitled',
    year: null,
    tmdbId: null,
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
    ...partial,
  };
}

describe('movieKey', () => {
  it('prefers tmdbId -> tmdb:<id>', () => {
    expect(movieKey(make({ tmdbId: 603, imdbId: 'tt0133093', year: 1999, title: 'The Matrix' }))).toBe(
      'tmdb:603',
    );
  });

  it('falls back to imdbId -> imdb:<id> when no tmdbId', () => {
    expect(movieKey(make({ imdbId: 'tt0133093', year: 1999, title: 'The Matrix' }))).toBe(
      'imdb:tt0133093',
    );
  });

  it('treats tmdbId of 0 as absent and falls through to imdbId', () => {
    expect(movieKey(make({ tmdbId: 0, imdbId: 'tt0133093', year: 1999, title: 'The Matrix' }))).toBe(
      'imdb:tt0133093',
    );
  });

  it('treats negative tmdbId as absent and falls through to year+title', () => {
    expect(movieKey(make({ tmdbId: -1, year: 1999, title: 'The Matrix' }))).toBe(
      'yt:1999:The Matrix',
    );
  });

  it('treats an empty imdbId as absent and falls through to year+title', () => {
    expect(movieKey(make({ imdbId: '', year: 1999, title: 'The Matrix' }))).toBe(
      'yt:1999:The Matrix',
    );
  });

  it('falls back to yt:<year>:<normalizedTitle> when no ids', () => {
    expect(movieKey(make({ year: 2003, title: 'The Matrix: Reloaded' }))).toBe(
      'yt:2003:The Matrix Reloaded',
    );
  });

  it('handles a missing year in the year+title branch', () => {
    expect(movieKey(make({ year: null, title: 'Orphan' }))).toBe('yt::Orphan');
  });
});

describe('normalizeTitle', () => {
  it('strips the exact Gaps bad-character set incl. backtick and asterisk', () => {
    const input = '<>`~[]()*&^%$#@!|{}.,?-_=+:;';
    expect(normalizeTitle(input)).toBe('');
  });

  it('keeps spaces, letters, digits and apostrophes', () => {
    expect(normalizeTitle("Marvel's: The Avengers (2012)!")).toBe("Marvel's The Avengers 2012");
  });

  it('removes only the stripped chars from a real title', () => {
    expect(normalizeTitle('Spider-Man: Far From Home')).toBe('SpiderMan Far From Home');
  });
});
