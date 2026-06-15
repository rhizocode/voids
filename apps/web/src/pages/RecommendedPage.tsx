/**
 * Recommended (Voids) page: run a gap search with a live progress bar driven by
 * `useJobProgress`, then browse the discovered gaps grouped by collection
 * (poster cards with collection backdrops) or as a table. Approve/reject/export
 * controls are Phase 3 — space is left for them but they are not built here.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecommendedMovie } from '@voids/shared';
import { useRecommended, useStartSearch } from '../api/hooks';
import { useJobProgress } from '../hooks/useJobProgress';
import { PageHeader } from '../components/PageHeader';
import { LibrarySelector, type LibrarySelection } from '../components/LibrarySelector';
import { MovieCard } from '../components/MovieCard';
import { MoviesTable } from '../components/MoviesTable';
import { Badge, Button, Card, Spinner, useToast } from '../components/ui';

function statusTone(status: RecommendedMovie['status']) {
  switch (status) {
    case 'approved':
      return 'success' as const;
    case 'rejected':
      return 'danger' as const;
    case 'ignored':
      return 'neutral' as const;
    default:
      return 'info' as const;
  }
}

interface CollectionGroup {
  title: string;
  backdropUrl: string | null;
  movies: RecommendedMovie[];
}

function groupByCollection(movies: RecommendedMovie[]): CollectionGroup[] {
  const groups = new Map<string, CollectionGroup>();
  for (const m of movies) {
    const title = m.collectionTitle ?? 'Uncategorized';
    let g = groups.get(title);
    if (!g) {
      g = { title, backdropUrl: m.backdropUrl, movies: [] };
      groups.set(title, g);
    }
    if (!g.backdropUrl && m.backdropUrl) g.backdropUrl = m.backdropUrl;
    g.movies.push(m);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function RecommendedPage() {
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [jobId, setJobId] = useState<number | null>(null);
  const { toast } = useToast();

  const startSearch = useStartSearch();
  const progress = useJobProgress(jobId);
  const recommended = useRecommended(selection?.serverId ?? null, selection?.libraryKey ?? null);

  // Refetch results when the job finishes.
  const wasFinished = useRef(false);
  useEffect(() => {
    if (progress.finished && !wasFinished.current) {
      wasFinished.current = true;
      void recommended.refetch();
      const reason = progress.reason ?? '';
      if (progress.status === 'succeeded') {
        toast(`Search finished. ${reason}`.trim(), 'success');
      } else if (progress.status === 'cancelled') {
        toast('Search cancelled.', 'info');
      } else if (progress.status === 'failed') {
        toast(`Search failed. ${reason}`.trim(), 'error');
      }
    }
    if (!progress.finished) wasFinished.current = false;
  }, [progress.finished, progress.status, progress.reason, recommended, toast]);

  const running = jobId != null && !progress.finished;

  const onRun = () => {
    if (!selection) return;
    startSearch.mutate(selection, {
      onSuccess: (res) => setJobId(res.jobId),
      onError: (err) =>
        toast(err instanceof Error ? err.message : 'Could not start search.', 'error'),
    });
  };

  const movies: RecommendedMovie[] = recommended.data ?? [];
  const groups = useMemo(() => groupByCollection(movies), [movies]);

  const pct =
    progress.totalCount > 0
      ? Math.min(100, Math.round((progress.searchedCount / progress.totalCount) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        title="Recommended (Voids)"
        subtitle="Run a search to find the missing entries in your collections."
      />

      <Card className="mb-6">
        <LibrarySelector
          value={selection}
          onChange={(s) => {
            setSelection(s);
            setJobId(null);
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={onRun} disabled={!selection || running || startSearch.isPending}>
            {running || startSearch.isPending ? <Spinner /> : null}
            {running ? 'Searching…' : 'Run search'}
          </Button>
          {running ? (
            <Button variant="danger" onClick={progress.cancel}>
              Cancel
            </Button>
          ) : null}
        </div>

        {jobId != null ? (
          <div className="mt-4" aria-label="search progress">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>
                {progress.searchedCount} / {progress.totalCount || '?'} searched · {pct}%
              </span>
              <span>{progress.foundCount} gaps found</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800"
            >
              <div
                className="h-full bg-indigo-500 transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            {progress.lastFoundMovie ? (
              <p className="mt-2 text-xs text-slate-400">
                Latest gap:{' '}
                <span className="text-slate-200">{progress.lastFoundMovie.title}</span>
                {progress.lastFoundMovie.collectionTitle
                  ? ` (${progress.lastFoundMovie.collectionTitle})`
                  : ''}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      {!selection ? null : recommended.isLoading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner /> Loading recommendations…
        </div>
      ) : movies.length === 0 ? (
        <Card className="text-center text-slate-400">
          <p className="text-slate-300">No gaps found yet.</p>
          <p className="mt-1 text-sm">Run a search to discover missing collection entries.</p>
        </Card>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              Recommended{' '}
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
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.title}>
                  <div
                    className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
                    style={
                      group.backdropUrl
                        ? {
                            backgroundImage: `linear-gradient(to right, rgba(2,6,23,0.92), rgba(2,6,23,0.55)), url(${group.backdropUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : undefined
                    }
                  >
                    <h3 className="px-4 py-3 text-base font-semibold text-white">
                      {group.title}{' '}
                      <span className="text-sm font-normal text-slate-300">
                        ({group.movies.length})
                      </span>
                    </h3>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {group.movies.map((m) => (
                      <MovieCard
                        key={m.id}
                        movie={m}
                        showOverview
                        badge={<Badge tone={statusTone(m.status)}>{m.status}</Badge>}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <MoviesTable data={movies} />
          )}
        </div>
      )}
    </div>
  );
}
