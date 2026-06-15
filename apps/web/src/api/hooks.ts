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
} from '@voids/shared';
import { get, post, put, del } from './client';

export const queryKeys = {
  settings: ['settings'] as const,
  servers: ['servers'] as const,
  version: ['version'] as const,
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
