/**
 * A poster card for a movie. Falls back to a titled placeholder when
 * `posterUrl` is null (owned movies frequently have no poster). Optional
 * `overview` snippet and status `badge` are used by the Recommended page.
 */
import type { ReactNode } from 'react';
import type { Movie } from '@voids/shared';

export function MoviePoster({ title, posterUrl }: { title: string; posterUrl: string | null }) {
  if (posterUrl) {
    return (
      <img
        src={posterUrl}
        alt={`${title} poster`}
        loading="lazy"
        className="aspect-[2/3] w-full rounded-md object-cover"
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${title} placeholder`}
      className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-slate-800 bg-slate-800/60 p-2 text-center text-xs text-slate-500"
    >
      No poster
    </div>
  );
}

export function MovieCard({
  movie,
  badge,
  showOverview = false,
}: {
  movie: Pick<Movie, 'title' | 'year' | 'posterUrl' | 'overview'>;
  badge?: ReactNode;
  showOverview?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="relative">
        <MoviePoster title={movie.title} posterUrl={movie.posterUrl} />
        {badge ? <div className="absolute right-1 top-1">{badge}</div> : null}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-100" title={movie.title}>
        {movie.title}
      </div>
      {movie.year != null ? <div className="text-xs text-slate-500">{movie.year}</div> : null}
      {showOverview && movie.overview ? (
        <p className="mt-1 line-clamp-3 text-xs text-slate-400">{movie.overview}</p>
      ) : null}
    </div>
  );
}
