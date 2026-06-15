/**
 * Fake fixtures for component tests. All values are placeholders — NO real
 * tokens, keys, or IP addresses appear here.
 */
import type {
  MediaServerView,
  Movie,
  RecommendedMovie,
  RssFeedInfo,
  SettingsResponse,
} from '@voids/shared';

export const fakeSettings: SettingsResponse = {
  tmdbApiKey: null,
  schedule: { enabled: true, mode: 'preset', presetId: 1, cron: '0 0 4 * * ?' },
  movieStatus: 0,
  connectTimeoutMs: 10000,
  readTimeoutMs: 30000,
  authMode: 'none',
  autoPushRadarr: false,
};

export const fakeServers: MediaServerView[] = [
  {
    id: 'server-1',
    type: 'jellyfin',
    name: 'Test Media Server',
    address: 'media.example.test',
    port: 8096,
    useHttps: false,
    libraries: [
      {
        serverId: 'server-1',
        key: 'lib-movies',
        title: 'Movies',
        type: 'movie',
        collectionType: 'movies',
        enabled: true,
        isDefault: true,
      },
      {
        serverId: 'server-1',
        key: 'lib-shows',
        title: 'TV Shows',
        type: 'show',
        collectionType: 'tvshows',
        enabled: false,
        isDefault: false,
      },
    ],
  },
];

function fakeMovie(over: Partial<Movie>): Movie {
  return {
    title: 'Untitled',
    year: 2000,
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
    ...over,
  };
}

export const fakeOwnedMovies: Movie[] = [
  fakeMovie({ title: 'The Fast and the Furious', year: 2001, tmdbId: 9799, mediaItemId: 'm1' }),
  // posterUrl null on purpose — owned movies often lack posters.
  fakeMovie({ title: '2 Fast 2 Furious', year: 2003, tmdbId: 584, mediaItemId: 'm2' }),
];

export const fakeRecommended: RecommendedMovie[] = [
  {
    ...fakeMovie({
      title: 'Fast Five',
      year: 2011,
      tmdbId: 51497,
      imdbId: 'tt1596343',
      collectionId: 9485,
      collectionTitle: 'The Fast and the Furious Collection',
      posterUrl: 'https://image.tmdb.org/t/p/w185/fake-fast-five.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/original/fake-backdrop.jpg',
      overview: 'Dom and the crew pull off a heist in Rio.',
      genres: ['Action'],
    }),
    id: 1,
    status: 'new',
    discoveredAt: 1700000000,
  },
  {
    ...fakeMovie({
      title: 'Furious 7',
      year: 2015,
      tmdbId: 168259,
      collectionId: 9485,
      collectionTitle: 'The Fast and the Furious Collection',
      posterUrl: null,
      overview: 'The crew faces a vengeful enemy.',
      genres: ['Action'],
    }),
    id: 2,
    status: 'new',
    discoveredAt: 1700000001,
  },
  {
    ...fakeMovie({
      title: 'Toy Story 4',
      year: 2019,
      tmdbId: 301528,
      collectionId: 10194,
      collectionTitle: 'Toy Story Collection',
      posterUrl: 'https://image.tmdb.org/t/p/w185/fake-ts4.jpg',
      overview: 'Woody embarks on a road trip.',
      genres: ['Animation'],
    }),
    id: 3,
    status: 'approved',
    discoveredAt: 1700000002,
  },
];

export const fakeRssFeeds: RssFeedInfo[] = [
  {
    serverId: 'server-1',
    libraryKey: 'lib-movies',
    title: 'Movies',
    url: '/rss/server-1/lib-movies',
    count: 3,
  },
  {
    serverId: 'server-1',
    libraryKey: 'lib-4k',
    title: '4K Movies',
    url: '/rss/server-1/lib-4k',
    count: 1,
  },
];
