/**
 * Fake fixtures for component tests. All values are placeholders — NO real
 * tokens, keys, or IP addresses appear here.
 */
import type { MediaServerView, SettingsResponse } from '@voids/shared';

export const fakeSettings: SettingsResponse = {
  tmdbApiKey: null,
  schedule: { id: 1, label: 'Daily', cron: '0 0 4 * * ?', enabled: true, custom: false },
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
        enabled: false,
        isDefault: false,
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
