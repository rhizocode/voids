/**
 * Per-item approval controls for a recommendation. Shows the current status as
 * a colored badge and offers transitions: Approve / Reject / Ignore, and a
 * revert to New (shown only when the item is not already `new`). Used on both
 * the poster cards and the table rows of the Recommended page.
 */
import type { RecommendedMovie, RecommendedMovieStatus } from '@voids/shared';
import { Badge, Button } from './ui';

export function statusTone(status: RecommendedMovieStatus) {
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

export function StatusBadge({ status }: { status: RecommendedMovieStatus }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}

export function StatusControls({
  movie,
  onSetStatus,
  disabled,
  size = 'sm',
}: {
  movie: RecommendedMovie;
  onSetStatus: (status: RecommendedMovieStatus) => void;
  disabled?: boolean;
  size?: 'sm';
}) {
  const is = (s: RecommendedMovieStatus) => movie.status === s;
  return (
    <div className="flex flex-wrap gap-1" aria-label={`Status controls for ${movie.title}`}>
      <Button
        size={size}
        variant={is('approved') ? 'primary' : 'secondary'}
        disabled={disabled || is('approved')}
        onClick={() => onSetStatus('approved')}
        aria-label={`Approve ${movie.title}`}
      >
        Approve
      </Button>
      <Button
        size={size}
        variant={is('rejected') ? 'danger' : 'secondary'}
        disabled={disabled || is('rejected')}
        onClick={() => onSetStatus('rejected')}
        aria-label={`Reject ${movie.title}`}
      >
        Reject
      </Button>
      <Button
        size={size}
        variant="ghost"
        disabled={disabled || is('ignored')}
        onClick={() => onSetStatus('ignored')}
        aria-label={`Ignore ${movie.title}`}
      >
        Ignore
      </Button>
      {!is('new') ? (
        <Button
          size={size}
          variant="ghost"
          disabled={disabled}
          onClick={() => onSetStatus('new')}
          aria-label={`Reset ${movie.title} to new`}
        >
          New
        </Button>
      ) : null}
    </div>
  );
}
