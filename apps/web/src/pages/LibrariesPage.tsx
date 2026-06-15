/**
 * Libraries page: pick a server/library, scan it into owned movies, and browse
 * the result as a poster card grid or a paginated table. Large libraries stay
 * responsive via a "load more" grid and a paginated table.
 */
import { useState } from 'react';
import type { Movie } from '@voids/shared';
import { useOwnedMovies, useScanLibrary } from '../api/hooks';
import { PageHeader } from '../components/PageHeader';
import { LibrarySelector, type LibrarySelection } from '../components/LibrarySelector';
import { MovieCard } from '../components/MovieCard';
import { MoviesTable } from '../components/MoviesTable';
import { Button, Card, Spinner, useToast } from '../components/ui';

const GRID_PAGE = 60;

export function LibrariesPage() {
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);
  const [lastScanCount, setLastScanCount] = useState<number | null>(null);
  const { toast } = useToast();

  const owned = useOwnedMovies(selection?.serverId ?? null, selection?.libraryKey ?? null);
  const scan = useScanLibrary();

  const movies: Movie[] = owned.data ?? [];

  const onScan = () => {
    if (!selection) return;
    setLastScanCount(null);
    scan.mutate(selection, {
      onSuccess: (result) => {
        setLastScanCount(result.count);
        setGridLimit(GRID_PAGE);
        toast(`Scanned ${result.count} movies.`, 'success');
        void owned.refetch();
      },
      onError: (err) => toast(err instanceof Error ? err.message : 'Scan failed.', 'error'),
    });
  };

  return (
    <div>
      <PageHeader
        title="Libraries"
        subtitle="Scan a media library and browse the movies you own."
      />

      <Card className="mb-6">
        <LibrarySelector
          value={selection}
          onChange={(s) => {
            setSelection(s);
            setLastScanCount(null);
            setGridLimit(GRID_PAGE);
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={onScan} disabled={!selection || scan.isPending}>
            {scan.isPending ? <Spinner /> : null}
            {scan.isPending ? 'Scanning…' : 'Scan library'}
          </Button>
          {lastScanCount != null ? (
            <span className="text-sm text-slate-400">Last scan: {lastScanCount} movies</span>
          ) : null}
        </div>
      </Card>

      {!selection ? null : owned.isLoading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner /> Loading owned movies…
        </div>
      ) : owned.isError ? (
        <Card className="text-sm text-red-300">Could not load owned movies.</Card>
      ) : movies.length === 0 ? (
        <Card className="text-center text-slate-400">
          <p className="text-slate-300">No owned movies yet.</p>
          <p className="mt-1 text-sm">Run a scan to populate this library.</p>
        </Card>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              Owned movies{' '}
              <span className="text-sm font-normal text-slate-500">({movies.length})</span>
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={view === 'grid' ? 'primary' : 'secondary'}
                onClick={() => setView('grid')}
              >
                Cards
              </Button>
              <Button
                size="sm"
                variant={view === 'table' ? 'primary' : 'secondary'}
                onClick={() => setView('table')}
              >
                Table
              </Button>
            </div>
          </div>

          {view === 'grid' ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {movies.slice(0, gridLimit).map((m, i) => (
                  <MovieCard key={`${m.mediaItemId ?? m.tmdbId ?? m.title}-${i}`} movie={m} />
                ))}
              </div>
              {gridLimit < movies.length ? (
                <div className="mt-6 text-center">
                  <Button
                    variant="secondary"
                    onClick={() => setGridLimit((n) => n + GRID_PAGE)}
                  >
                    Load more ({movies.length - gridLimit} remaining)
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <MoviesTable data={movies} />
          )}
        </div>
      )}
    </div>
  );
}
