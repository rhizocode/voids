/**
 * Copy/export affordance for the currently-filtered recommendations: copy the
 * TMDB ids to the clipboard, or download the filtered list as Radarr-style
 * JSON or a triage CSV. All client-side; each action toasts confirmation.
 */
import type { RecommendedMovie } from '@voids/shared';
import { Button, useToast } from './ui';
import { downloadFile, toCsv, toRadarrList, tmdbIdsCsv } from '../api/exporters';

export function ExportBar({
  movies,
  filename = 'voids-recommendations',
}: {
  movies: RecommendedMovie[];
  filename?: string;
}) {
  const { toast } = useToast();
  const empty = movies.length === 0;

  const copyIds = async () => {
    const ids = tmdbIdsCsv(movies);
    if (!ids) {
      toast('No TMDB ids to copy.', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(ids);
      toast(`Copied ${ids.split(',').length} TMDB ids to clipboard.`, 'success');
    } catch {
      toast('Could not access the clipboard.', 'error');
    }
  };

  const exportJson = () => {
    downloadFile(
      `${filename}.json`,
      JSON.stringify(toRadarrList(movies), null, 2),
      'application/json',
    );
    toast(`Exported ${movies.length} items as JSON.`, 'success');
  };

  const exportCsv = () => {
    downloadFile(`${filename}.csv`, toCsv(movies), 'text/csv');
    toast(`Exported ${movies.length} items as CSV.`, 'success');
  };

  return (
    <div className="flex flex-wrap gap-2" aria-label="export controls">
      <Button size="sm" variant="secondary" onClick={copyIds} disabled={empty}>
        Copy TMDB IDs
      </Button>
      <Button size="sm" variant="secondary" onClick={exportJson} disabled={empty}>
        Export JSON
      </Button>
      <Button size="sm" variant="secondary" onClick={exportCsv} disabled={empty}>
        Export CSV
      </Button>
    </div>
  );
}
