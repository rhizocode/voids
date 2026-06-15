/**
 * Fake fixtures for component tests. All values are placeholders — NO real
 * tokens, keys, or IP addresses appear here.
 */
import type {
  MediaServerView,
  MislabeledItem,
  Movie,
  MovieStatusResponse,
  NotificationProviderConfig,
  RadarrConfig,
  RadarrPushResult,
  RadarrQualityProfile,
  RadarrRootFolder,
  RecommendedMovie,
  RssFeedInfo,
  ScheduleConfig,
  SchedulePresetsResponse,
  SettingsResponse,
} from '@voids/shared';
import {
  NOTIFICATION_PROVIDER_NAMES,
  NotificationProviderId,
  allNotificationTypes,
  defaultNotificationConfig,
  type NotificationProviderId as ProviderId,
} from '@voids/shared';

export const fakeSettings: SettingsResponse = {
  tmdbApiKey: null,
  schedule: { enabled: true, mode: 'preset', presetId: 1, cron: '0 0 4 * * ?' },
  movieStatus: 0,
  connectTimeoutMs: 10000,
  readTimeoutMs: 30000,
  authMode: 'none',
  autoPushRadarr: false,
  radarr: null,
};

export const fakeSchedule: ScheduleConfig = {
  enabled: true,
  mode: 'preset',
  presetId: 1,
  cron: '0 0 4 * * ?',
};

export const fakeSchedulePresets: SchedulePresetsResponse = [
  { id: 0, label: 'Hourly', cron: '0 49 * * * ?', enabled: true },
  { id: 1, label: 'Daily', cron: '0 0 4 * * ?', enabled: true },
  { id: 2, label: 'Weekly', cron: '0 0 4 * * MON', enabled: true },
  { id: 3, label: 'Bi-weekly', cron: '0 0 4 1,15 * ?', enabled: true },
  { id: 4, label: 'Monthly', cron: '0 0 4 1 * ?', enabled: true },
];

export const fakeMovieStatus: MovieStatusResponse = { id: 0, label: 'All' };

/** A fake, fully-populated Radarr config. NO real URL or key. */
export const fakeRadarrConfig: RadarrConfig = {
  url: 'http://radarr.example.test:7878',
  apiKey: 'fake-radarr-key',
  qualityProfileId: 2,
  rootFolderPath: '/movies',
  monitored: true,
  minimumAvailability: 'released',
  searchOnAdd: true,
};

/** Settings with a configured Radarr + auto-push on, for the Radarr tab. */
export const fakeSettingsWithRadarr: SettingsResponse = {
  ...fakeSettings,
  autoPushRadarr: true,
  radarr: fakeRadarrConfig,
};

export const fakeRadarrQualityProfiles: RadarrQualityProfile[] = [
  { id: 1, name: 'Any' },
  { id: 2, name: 'HD-1080p' },
  { id: 3, name: 'Ultra-HD' },
];

export const fakeRadarrRootFolders: RadarrRootFolder[] = [
  { path: '/movies', freeSpace: 123456789 },
  { path: '/movies-4k', freeSpace: 987654321 },
];

export const fakeRadarrPushResults: RadarrPushResult[] = [
  { tmdbId: 51497, title: 'Fast Five', status: 'added' },
  { tmdbId: 168259, title: 'Furious 7', status: 'added' },
  { tmdbId: 301528, title: 'Toy Story 4', status: 'exists' },
];

export const fakeMislabeled: MislabeledItem[] = [
  { ownedTitle: 'The Matrx', tmdbTitle: 'The Matrix', year: 1999, tmdbId: 603, distance: 1 },
  {
    ownedTitle: 'Blade Runer 2049',
    tmdbTitle: 'Blade Runner 2049',
    year: 2017,
    tmdbId: 335984,
    distance: 1,
  },
];

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

/**
 * All seven notification providers at their schema defaults (every config
 * field empty/default, no subscriptions, disabled). NO real tokens or URLs.
 */
export const fakeNotifications: NotificationProviderConfig[] = (
  Object.values(NotificationProviderId) as ProviderId[]
).map((id) => ({
  id,
  name: NOTIFICATION_PROVIDER_NAMES[id],
  enabled: false,
  config: defaultNotificationConfig(id),
  notificationTypes: [],
}));

/** One enabled, fully-configured provider (Slack, id 2) with a fake webhook. */
export const fakeSlackEnabled: NotificationProviderConfig = {
  id: NotificationProviderId.SLACK,
  name: NOTIFICATION_PROVIDER_NAMES[NotificationProviderId.SLACK],
  enabled: true,
  config: { id: NotificationProviderId.SLACK, webHookUrl: 'https://example.test/fake-webhook' },
  notificationTypes: allNotificationTypes.filter((t) => t !== 'TEST'),
};
