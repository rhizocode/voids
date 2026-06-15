/**
 * Client-side export helpers for the Recommended page. These mirror the
 * server's RSS serialization (`RssService.toRssItem`) so the JSON download is
 * byte-compatible with the Radarr custom-list feed; the CSV is a
 * spreadsheet-friendly triage export. None of these touch the network.
 */
import type { RecommendedMovie, RssItem } from '@voids/shared';

/** Comma-separated TMDB ids of the given movies (skips any without a tmdbId). */
export function tmdbIdsCsv(movies: RecommendedMovie[]): string {
  return movies
    .map((m) => m.tmdbId)
    .filter((id): id is number => id != null)
    .join(',');
}

/**
 * Radarr-style list — identical shape to the server feed
 * (`{ title, imdb_id, tmdb_id, release_date, poster_path }`), so an exported
 * JSON file can be hand-fed to Radarr the same way the live feed is.
 */
export function toRadarrList(movies: RecommendedMovie[]): RssItem[] {
  return movies.map((m) => ({
    title: m.title,
    imdb_id: m.imdbId ?? null,
    tmdb_id: m.tmdbId ?? null,
    release_date: m.year ?? null,
    poster_path: m.posterUrl ?? '',
  }));
}

/** Escape one CSV field per RFC 4180 (quote when it contains "," | '"' | newline). */
function csvField(value: string | number | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with header `title,year,tmdb_id,imdb_id,collection,status`. */
export function toCsv(movies: RecommendedMovie[]): string {
  const header = ['title', 'year', 'tmdb_id', 'imdb_id', 'collection', 'status'];
  const rows = movies.map((m) =>
    [m.title, m.year, m.tmdbId, m.imdbId, m.collectionTitle, m.status].map(csvField).join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

/** Trigger a client-side file download of `content` as `filename`. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
