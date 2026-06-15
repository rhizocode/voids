import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { movieKey } from '@voids/shared';
import {
  mapJellyfinItemToMovie,
  mapJellyfinVirtualFolders,
  type JellyfinItemsResponse,
  type JellyfinVirtualFolder,
} from './jellyfin.client';

const itemsFixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'jellyfin-items.json'), 'utf8'),
) as JellyfinItemsResponse;

const foldersFixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'jellyfin-virtual-folders.json'), 'utf8'),
) as JellyfinVirtualFolder[];

describe('mapJellyfinItemToMovie', () => {
  const [withCollection, withoutCollection, missingTmdb] = itemsFixture.Items.map(
    mapJellyfinItemToMovie,
  );

  it('maps a movie WITH a TmdbCollection (collectionId populated)', () => {
    expect(withCollection.title).toBe('2 Fast 2 Furious');
    expect(withCollection.tmdbId).toBe(584);
    expect(withCollection.imdbId).toBe('tt0322259');
    expect(withCollection.collectionId).toBe(9485);
    expect(withCollection.year).toBe(2003);
    expect(withCollection.genres).toEqual(['Action', 'Crime', 'Thriller']);
    expect(withCollection.mediaItemId).toBe('28ae9ee0005062617012fbb03c055e27');
    expect(withCollection.mediaItemKey).toBe('28ae9ee0005062617012fbb03c055e27');
    expect(movieKey(withCollection)).toBe('tmdb:584');
  });

  it('maps a movie WITHOUT a TmdbCollection (collectionId null)', () => {
    expect(withoutCollection.title).toBe('2 Guns');
    expect(withoutCollection.tmdbId).toBe(136400);
    expect(withoutCollection.collectionId).toBeNull();
  });

  it('maps a movie MISSING Tmdb (tmdbId null, imdb retained)', () => {
    expect(missingTmdb.title).toBe('Untracked Indie Film');
    expect(missingTmdb.tmdbId).toBeNull();
    expect(missingTmdb.imdbId).toBe('tt8106534');
    expect(missingTmdb.collectionId).toBeNull();
    expect(movieKey(missingTmdb)).toBe('imdb:tt8106534');
  });

  it('defaults genres to [] when absent', () => {
    const movie = mapJellyfinItemToMovie({ Id: 'x', Name: 'No Genres' });
    expect(movie.genres).toEqual([]);
    expect(movie.tmdbId).toBeNull();
  });

  it('treats a Tmdb ProviderIds value of "0" as null (dirty metadata)', () => {
    const movie = mapJellyfinItemToMovie({
      Id: 'x',
      Name: 'Dirty Meta',
      ProviderIds: { Tmdb: '0', TmdbCollection: '0' },
    });
    expect(movie.tmdbId).toBeNull();
    expect(movie.collectionId).toBeNull();
  });
});

describe('mapJellyfinVirtualFolders', () => {
  it('keeps only movie libraries and maps fields', () => {
    const libs = mapJellyfinVirtualFolders(foldersFixture);
    expect(libs).toHaveLength(1);
    expect(libs[0]).toEqual({
      serverId: '',
      key: 'lib0000000000000000000000000000aa',
      title: 'Movies',
      type: 'movie',
      collectionType: 'movies',
      enabled: false,
      isDefault: false,
    });
  });
});
