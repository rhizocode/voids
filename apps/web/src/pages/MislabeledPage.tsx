/**
 * Mislabeled page: pick a server/library and a Levenshtein threshold, then run
 * an on-demand scan that flags owned movies whose media-server title differs
 * from the canonical TMDB title for the same tmdbId by more than the threshold.
 * The scan is lazy (`useMislabeled` enabled only after Scan) since a cold-cache
 * run can be slow.
 */
import { useState } from 'react';
import type { MislabeledItem } from '@voids/shared';
import { useMislabeled } from '../api/hooks';
import { PageHeader } from '../components/PageHeader';
import { LibrarySelector, type LibrarySelection } from '../components/LibrarySelector';
import { Button, Card, Input, Label, Spinner } from '../components/ui';

export function MislabeledPage() {
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [threshold, setThreshold] = useState(3);
  // The scanned threshold is frozen at Scan time so editing the input does not
  // re-trigger the (potentially slow) query until the user scans again.
  const [scan, setScan] = useState<{ threshold: number } | null>(null);

  const mislabeled = useMislabeled(
    selection?.serverId ?? null,
    selection?.libraryKey ?? null,
    scan?.threshold ?? threshold,
    scan != null,
  );

  const items: MislabeledItem[] = mislabeled.data ?? [];
  const canScan = selection != null && threshold >= 0;

  return (
    <div>
      <PageHeader
        title="Mislabeled"
        subtitle="Find owned movies whose title differs from the canonical TMDB title for the same TMDB id."
      />

      <Card className="mb-6">
        <LibrarySelector
          value={selection}
          onChange={(s) => {
            setSelection(s);
            setScan(null);
          }}
        />

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="w-40">
            <Label htmlFor="mislabeled-threshold">Distance threshold</Label>
            <Input
              id="mislabeled-threshold"
              type="number"
              min={0}
              className="mt-1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
          <Button
            onClick={() => setScan({ threshold })}
            disabled={!canScan || mislabeled.isFetching}
          >
            {mislabeled.isFetching && <Spinner />}
            Scan
          </Button>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Flags entries whose Levenshtein distance from the TMDB title exceeds the threshold. The
          first scan may take a while on a cold cache.
        </p>
      </Card>

      {scan == null ? null : mislabeled.isFetching ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner /> Scanning for mislabeled entries… (the first scan may take a while)
        </div>
      ) : mislabeled.isError ? (
        <Card className="text-sm text-red-400">
          The scan failed. Try again.
        </Card>
      ) : items.length === 0 ? (
        <Card className="text-center text-sm text-slate-400">
          No likely-mislabeled entries found.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Owned title</th>
                <th className="px-4 py-3 font-medium">TMDB title</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Distance</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.tmdbId} className="border-b border-slate-800/50">
                  <td className="px-4 py-3 text-slate-200">{item.ownedTitle}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://www.themoviedb.org/movie/${item.tmdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      {item.tmdbTitle}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{item.year ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{item.distance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
