/**
 * Recommended (Voids) page: run a gap search with a live progress bar driven by
 * `useJobProgress`, then triage the discovered gaps. Phase 3 adds the approval
 * workflow (Approve/Reject/Ignore/New per item, plus bulk actions), a status
 * filter (rejected/ignored hidden by default since they persist across runs),
 * and copy/export affordances. Results are grouped by collection (cards) or
 * shown in a table — the Phase 2 run/cancel/progress flow is unchanged.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecommendedMovie, RecommendedMovieStatus } from '@voids/shared';
import {
  useRecommended,
  useStartSearch,
  useUpdateRecommendation,
  useBulkUpdateRecommendations,
} from '../api/hooks';
import { useJobProgress } from '../hooks/useJobProgress';
import { PageHeader } from '../components/PageHeader';
import { LibrarySelector, type LibrarySelection } from '../components/LibrarySelector';
import { MovieCard } from '../components/MovieCard';
import { RecommendedTable } from '../components/RecommendedTable';
import { ExportBar } from '../components/ExportBar';
import { StatusBadge, StatusControls } from '../components/StatusControls';
import { Button, Card, Label, Select, Spinner, useToast } from '../components/ui';

type StatusFilter = 'default' | 'all' | RecommendedMovieStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'default', label: 'New + Approved' },
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'ignored', label: 'Ignored' },
];

/** Whether a movie passes the active status filter. */
function matchesFilter(movie: RecommendedMovie, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'default') return movie.status === 'new' || movie.status === 'approved';
  return movie.status === filter;
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
  const [filter, setFilter] = useState<StatusFilter>('default');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const startSearch = useStartSearch();
  const progress = useJobProgress(jobId);
  const recommended = useRecommended(selection?.serverId ?? null, selection?.libraryKey ?? null);
  const updateOne = useUpdateRecommendation(
    selection?.serverId ?? null,
    selection?.libraryKey ?? null,
  );
  const updateMany = useBulkUpdateRecommendations(
    selection?.serverId ?? null,
    selection?.libraryKey ?? null,
  );

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

  const allMovies: RecommendedMovie[] = recommended.data ?? [];
  const filtered = useMemo(
    () => allMovies.filter((m) => matchesFilter(m, filter)),
    [allMovies, filter],
  );
  const groups = useMemo(() => groupByCollection(filtered), [filtered]);

  // Keep selection scoped to currently-visible items.
  const visibleIds = useMemo(() => new Set(filtered.map((m) => m.id)), [filtered]);
  const activeSelection = useMemo(
    () => new Set([...selected].filter((id) => visibleIds.has(id))),
    [selected, visibleIds],
  );

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setStatus = (id: number, status: RecommendedMovieStatus) => {
    updateOne.mutate(
      { itemId: id, status },
      { onError: (err) => toast(err instanceof Error ? err.message : 'Update failed.', 'error') },
    );
  };

  const bulkSet = (status: RecommendedMovieStatus) => {
    const ids = [...activeSelection];
    if (ids.length === 0) return;
    updateMany.mutate(
      { ids, status },
      {
        onSuccess: () => {
          toast(`Set ${ids.length} item${ids.length === 1 ? '' : 's'} to ${status}.`, 'success');
          setSelected(new Set());
        },
        onError: (err) =>
          toast(err instanceof Error ? err.message : 'Bulk update failed.', 'error'),
      },
    );
  };

  const pct =
    progress.totalCount > 0
      ? Math.min(100, Math.round((progress.searchedCount / progress.totalCount) * 100))
      : 0;

  const mutating = updateOne.isPending || updateMany.isPending;

  return (
    <div>
      <PageHeader
        title="Recommended (Voids)"
        subtitle="Run a search to find the missing entries in your collections, then approve or reject each gap."
      />

      <Card className="mb-6">
        <LibrarySelector
          value={selection}
          onChange={(s) => {
            setSelection(s);
            setJobId(null);
            setSelected(new Set());
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
      ) : allMovies.length === 0 ? (
        <Card className="text-center text-slate-400">
          <p className="text-slate-300">No gaps found yet.</p>
          <p className="mt-1 text-sm">Run a search to discover missing collection entries.</p>
        </Card>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Recommended{' '}
                  <span className="text-sm font-normal text-slate-500">
                    ({filtered.length}
                    {filtered.length !== allMovies.length ? ` of ${allMovies.length}` : ''})
                  </span>
                </h2>
              </div>
              <div className="w-44">
                <Label htmlFor="status-filter">Status filter</Label>
                <Select
                  id="status-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as StatusFilter)}
                >
                  {FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
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

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ExportBar movies={filtered} filename={`voids-${selection.libraryKey}`} />
            {activeSelection.size > 0 ? (
              <div className="flex items-center gap-2" aria-label="bulk actions">
                <span className="text-sm text-slate-400">{activeSelection.size} selected</span>
                <Button
                  size="sm"
                  onClick={() => bulkSet('approved')}
                  disabled={mutating}
                >
                  Approve selected
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => bulkSet('rejected')}
                  disabled={mutating}
                >
                  Reject selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <Card className="text-center text-sm text-slate-400">
              No recommendations match this filter.
            </Card>
          ) : view === 'grid' ? (
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
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {group.movies.map((m) => (
                      <div key={m.id} className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-xs text-slate-400">
                          <input
                            type="checkbox"
                            aria-label={`Select ${m.title}`}
                            checked={activeSelection.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                          />
                          select
                        </label>
                        <MovieCard
                          movie={m}
                          showOverview
                          badge={<StatusBadge status={m.status} />}
                        />
                        <StatusControls
                          movie={m}
                          disabled={mutating}
                          onSetStatus={(s) => setStatus(m.id, s)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <RecommendedTable
              data={filtered}
              selected={activeSelection}
              onToggleSelect={toggleSelect}
              onSetStatus={setStatus}
              mutationPending={mutating}
            />
          )}
        </div>
      )}
    </div>
  );
}
