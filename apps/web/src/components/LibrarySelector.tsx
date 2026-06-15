/**
 * Server + library picker shared by the Libraries and Recommended pages.
 * Lists configured media servers and their movie libraries; when none are
 * configured it renders an empty state linking to `/config`.
 */
import { Link } from 'react-router-dom';
import type { MediaLibrary, MediaServerView } from '@voids/shared';
import { useServers } from '../api/hooks';
import { Card, Label, Select, Spinner } from './ui';

export interface LibrarySelection {
  serverId: string;
  libraryKey: string;
}

function isMovieLibrary(l: MediaLibrary): boolean {
  return l.collectionType === 'movies' || l.type === 'movie';
}

export function LibrarySelector({
  value,
  onChange,
}: {
  value: LibrarySelection | null;
  onChange: (selection: LibrarySelection | null) => void;
}) {
  const servers = useServers();

  if (servers.isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Spinner /> Loading servers…
      </div>
    );
  }

  const serverList: MediaServerView[] = servers.data ?? [];
  if (serverList.length === 0) {
    return (
      <Card className="text-slate-400">
        <p className="text-slate-300">No media servers configured.</p>
        <p className="mt-1 text-sm">
          Add a media server on the{' '}
          <Link to="/config" className="text-indigo-400 hover:underline">
            Configuration
          </Link>{' '}
          page to get started.
        </p>
      </Card>
    );
  }

  const selectedServer = serverList.find((s) => s.id === value?.serverId) ?? null;
  const movieLibraries = (selectedServer?.libraries ?? []).filter(isMovieLibrary);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="server-select">Media server</Label>
        <Select
          id="server-select"
          value={value?.serverId ?? ''}
          onChange={(e) => {
            const serverId = e.target.value;
            const server = serverList.find((s) => s.id === serverId);
            const firstLib = (server?.libraries ?? []).filter(isMovieLibrary)[0];
            onChange(serverId && firstLib ? { serverId, libraryKey: firstLib.key } : null);
          }}
        >
          <option value="">Select a server…</option>
          {serverList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="library-select">Movie library</Label>
        <Select
          id="library-select"
          disabled={!selectedServer}
          value={value?.libraryKey ?? ''}
          onChange={(e) => {
            const libraryKey = e.target.value;
            if (value?.serverId && libraryKey) onChange({ serverId: value.serverId, libraryKey });
          }}
        >
          <option value="">
            {movieLibraries.length === 0 ? 'No movie libraries' : 'Select a library…'}
          </option>
          {movieLibraries.map((l) => (
            <option key={l.key} value={l.key}>
              {l.title}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
