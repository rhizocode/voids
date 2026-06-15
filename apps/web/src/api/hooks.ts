/**
 * TanStack Query hooks for the Voids backend. Query keys are kept consistent so
 * mutations can invalidate precisely (e.g. anything that changes servers or
 * their libraries invalidates `['servers']`). All return types come from
 * `@voids/shared`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SettingsResponse,
  UpdateSettingsRequest,
  ServersResponse,
  MediaServerView,
  AddServerRequest,
  ServerTestResponse,
  UpdateLibraryRequest,
  LibraryResponse,
  TmdbKeyRequest,
  TmdbKeyResponse,
  ScanResult,
  Movie,
  StartSearchResponse,
  SearchJob,
  RecommendedResponse,
  RecommendedMovie,
  RecommendedMovieStatus,
  UpdateRecommendationRequest,
  BulkUpdateRecommendationRequest,
  RssFeedListResponse,
  ScheduleConfig,
  UpdateScheduleRequest,
  SchedulePresetsResponse,
  ScheduleRunResponse,
  MovieStatusResponse,
  UpdateMovieStatusRequest,
  GetNotificationsResponse,
  GetNotificationResponse,
  UpdateNotificationRequest,
  TestResult,
  ProviderTestResult,
} from '@voids/shared';
import { get, post, put, patch, del } from './client';

export const queryKeys = {
  settings: ['settings'] as const,
  servers: ['servers'] as const,
  version: ['version'] as const,
  owned: (serverId: string, libraryKey: string) => ['owned', serverId, libraryKey] as const,
  recommended: (serverId: string, libraryKey: string) =>
    ['recommended', serverId, libraryKey] as const,
  job: (jobId: number) => ['job', jobId] as const,
  rss: ['rss'] as const,
  schedule: ['schedule'] as const,
  schedulePresets: ['schedule', 'presets'] as const,
  movieStatus: ['movieStatus'] as const,
  notifications: ['notifications'] as const,
};

/** GET /api/settings */
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => get<SettingsResponse>('/settings'),
  });
}

/** PUT /api/settings (partial) */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSettingsRequest) => put<SettingsResponse>('/settings', body),
    onSuccess: (data) => qc.setQueryData(queryKeys.settings, data),
  });
}

/** GET /api/servers */
export function useServers() {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: () => get<ServersResponse>('/servers'),
  });
}

/** POST /api/servers */
export function useAddServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddServerRequest) => post<MediaServerView>('/servers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.servers }),
  });
}

/** DELETE /api/servers/:id */
export function useDeleteServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del<void>(`/servers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.servers }),
  });
}

/** PUT /api/servers/:id/test */
export function useTestServer() {
  return useMutation({
    mutationFn: (id: string) => put<ServerTestResponse>(`/servers/${id}/test`),
  });
}

/** PUT /api/servers/:id/libraries/:key */
export function useToggleLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { serverId: string; key: string; body: UpdateLibraryRequest }) =>
      put<LibraryResponse>(`/servers/${vars.serverId}/libraries/${vars.key}`, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.servers }),
  });
}

/** PUT /api/tmdb/test */
export function useTmdbTest() {
  return useMutation({
    mutationFn: (body: TmdbKeyRequest) => put<TmdbKeyResponse>('/tmdb/test', body),
  });
}

/** POST /api/tmdb/key */
export function useSaveTmdbKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TmdbKeyRequest) => post<TmdbKeyResponse>('/tmdb/key', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

/** GET /api/version */
export function useVersion() {
  return useQuery({
    queryKey: queryKeys.version,
    queryFn: () => get<{ version: string }>('/version'),
  });
}

/** POST /api/libraries/:serverId/:libraryKey/scan — scan + persist owned movies. */
export function useScanLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { serverId: string; libraryKey: string }) =>
      post<ScanResult>(`/libraries/${vars.serverId}/${vars.libraryKey}/scan`),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.owned(vars.serverId, vars.libraryKey) }),
  });
}

/** GET /api/owned/:serverId/:libraryKey — stored owned movies. */
export function useOwnedMovies(serverId: string | null, libraryKey: string | null) {
  return useQuery({
    queryKey: queryKeys.owned(serverId ?? '', libraryKey ?? ''),
    queryFn: () => get<Movie[]>(`/owned/${serverId}/${libraryKey}`),
    enabled: Boolean(serverId) && Boolean(libraryKey),
  });
}

/** POST /api/search/:serverId/:libraryKey — enqueue a gap search. */
export function useStartSearch() {
  return useMutation({
    mutationFn: (vars: { serverId: string; libraryKey: string }) =>
      post<StartSearchResponse>(`/search/${vars.serverId}/${vars.libraryKey}`),
  });
}

/** GET /api/search/:jobId — job status (used as the WS polling fallback). */
export function useJobStatus(jobId: number | null, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.job(jobId ?? -1),
    queryFn: () => get<SearchJob>(`/search/${jobId}`),
    enabled: jobId != null,
    refetchInterval: options?.refetchInterval,
  });
}

/** GET /api/recommended/:serverId/:libraryKey — the discovered gaps. */
export function useRecommended(serverId: string | null, libraryKey: string | null) {
  return useQuery({
    queryKey: queryKeys.recommended(serverId ?? '', libraryKey ?? ''),
    queryFn: () => get<RecommendedResponse>(`/recommended/${serverId}/${libraryKey}`),
    enabled: Boolean(serverId) && Boolean(libraryKey),
  });
}

/**
 * PATCH /api/recommended/:itemId — set one recommendation's approval status.
 * Optimistically patches the cached list for the given library so the badge
 * and filters update instantly, rolling back on error; always reconciles by
 * invalidating `['recommended', serverId, libraryKey]` on settle.
 */
export function useUpdateRecommendation(serverId: string | null, libraryKey: string | null) {
  const qc = useQueryClient();
  const key = queryKeys.recommended(serverId ?? '', libraryKey ?? '');
  return useMutation({
    mutationFn: (vars: { itemId: number; status: RecommendedMovieStatus }) =>
      patch<RecommendedMovie>(`/recommended/${vars.itemId}`, {
        status: vars.status,
      } satisfies UpdateRecommendationRequest),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RecommendedResponse>(key);
      if (previous) {
        qc.setQueryData<RecommendedResponse>(
          key,
          previous.map((m) => (m.id === vars.itemId ? { ...m, status: vars.status } : m)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** PATCH /api/recommended (bulk) — apply one status to many ids at once. */
export function useBulkUpdateRecommendations(
  serverId: string | null,
  libraryKey: string | null,
) {
  const qc = useQueryClient();
  const key = queryKeys.recommended(serverId ?? '', libraryKey ?? '');
  return useMutation({
    mutationFn: (vars: { ids: number[]; status: RecommendedMovieStatus }) =>
      patch<{ updated: number }>('/recommended', {
        ids: vars.ids,
        status: vars.status,
      } satisfies BulkUpdateRecommendationRequest),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RecommendedResponse>(key);
      if (previous) {
        const ids = new Set(vars.ids);
        qc.setQueryData<RecommendedResponse>(
          key,
          previous.map((m) => (ids.has(m.id) ? { ...m, status: vars.status } : m)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** GET /api/rss — which library feeds exist (for the RSS page). */
export function useRssFeeds() {
  return useQuery({
    queryKey: queryKeys.rss,
    queryFn: () => get<RssFeedListResponse>('/rss'),
  });
}

/** GET /api/schedule — the current automation schedule config. */
export function useSchedule() {
  return useQuery({
    queryKey: queryKeys.schedule,
    queryFn: () => get<ScheduleConfig>('/schedule'),
  });
}

/** GET /api/schedule/all — the built-in preset list (id, label, cron, enabled). */
export function useSchedulePresets() {
  return useQuery({
    queryKey: queryKeys.schedulePresets,
    queryFn: () => get<SchedulePresetsResponse>('/schedule/all'),
  });
}

/**
 * PUT /api/schedule — persist + re-arm the cron. The server normalizes the
 * config (preset cron forced to match the preset), so we seed the cache with
 * the returned effective config and invalidate `['schedule']`.
 */
export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateScheduleRequest) => put<ScheduleConfig>('/schedule', body),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.schedule, data);
      void qc.invalidateQueries({ queryKey: queryKeys.schedule });
    },
  });
}

/** POST /api/schedule/run — trigger a full search run now (202, fire-and-forget). */
export function useRunScheduleNow() {
  return useMutation({
    mutationFn: () => post<ScheduleRunResponse>('/schedule/run'),
  });
}

/** GET /api/movie-status — whether only released movies are recommended. */
export function useMovieStatus() {
  return useQuery({
    queryKey: queryKeys.movieStatus,
    queryFn: () => get<MovieStatusResponse>('/movie-status'),
  });
}

/** PUT /api/movie-status — persist the movie-status (0 = all, 1 = released). */
export function useUpdateMovieStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMovieStatusRequest) =>
      put<MovieStatusResponse>('/movie-status', body),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.movieStatus, data);
      void qc.invalidateQueries({ queryKey: queryKeys.movieStatus });
    },
  });
}

/** GET /api/notifications — all seven notification provider configs. */
export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => get<GetNotificationsResponse>('/notifications'),
  });
}

/**
 * PUT /api/notifications/:provider — persist one provider's enabled flag,
 * config, and subscribed notification types. The server validates the config
 * against that provider's schema (400 on mismatch). On success we patch the
 * cached list entry in place and invalidate `['notifications']`.
 */
export function useUpdateNotification(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNotificationRequest) =>
      put<GetNotificationResponse>(`/notifications/${id}`, body),
    onSuccess: (data) => {
      qc.setQueryData<GetNotificationsResponse>(queryKeys.notifications, (prev) =>
        prev ? prev.map((p) => (p.id === data.id ? data : p)) : prev,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

/** PUT /api/notifications/:provider/test — send a TEST notification (70/71). */
export function useTestNotification(id: number) {
  return useMutation({
    mutationFn: () => put<TestResult>(`/notifications/${id}/test`),
  });
}

/** PUT /api/notifications/test-all — test every enabled provider. */
export function useTestAll() {
  return useMutation({
    mutationFn: () => put<ProviderTestResult[]>('/notifications/test-all'),
  });
}
