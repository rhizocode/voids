/**
 * RSS page: lists every library that has a feed-eligible recommendation (one
 * Card per `RssFeedInfo` from `GET /api/rss`). Each Card shows the library
 * title, item count, and the full absolute feed URL with Copy + external-link
 * affordances, plus a short Radarr explainer. Empty state links to Recommended.
 */
import { Link } from 'react-router-dom';
import type { RssFeedInfo } from '@voids/shared';
import { useRssFeeds } from '../api/hooks';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, Spinner, useToast } from '../components/ui';

/** Absolute feed URL (origin + the server-provided `/rss/...` path). */
function absoluteUrl(feed: RssFeedInfo): string {
  return `${window.location.origin}${feed.url}`;
}

function FeedCard({ feed }: { feed: RssFeedInfo }) {
  const { toast } = useToast();
  const url = absoluteUrl(feed);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Feed URL copied to clipboard.', 'success');
    } catch {
      toast('Could not access the clipboard.', 'error');
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{feed.title}</h3>
          <p className="text-sm text-slate-400">
            {feed.count} item{feed.count === 1 ? '' : 's'} in feed
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          {url}
        </code>
        <Button size="sm" variant="secondary" onClick={copy}>
          Copy URL
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="ghost">
            Open ↗
          </Button>
        </a>
      </div>
    </Card>
  );
}

export function RssPage() {
  const feeds = useRssFeeds();

  return (
    <div>
      <PageHeader
        title="RSS"
        subtitle="Public JSON feeds of your approved gaps, ready to plug into Radarr."
      />

      <Card className="mb-6 text-sm text-slate-400">
        Add a feed URL to Radarr as a list (StevenLu / custom JSON list) to auto-import
        approved gaps. Feeds are public (no auth) so Radarr can reach them, and exclude
        anything you have rejected or ignored.
      </Card>

      {feeds.isLoading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner /> Loading feeds…
        </div>
      ) : feeds.isError ? (
        <Card className="text-sm text-red-300">Could not load feeds.</Card>
      ) : (feeds.data ?? []).length === 0 ? (
        <Card className="text-center text-slate-400">
          <p className="text-slate-300">No feeds yet.</p>
          <p className="mt-1 text-sm">
            Feeds appear once a library has recommendations. Head to the{' '}
            <Link to="/recommended" className="text-indigo-400 hover:underline">
              Recommended
            </Link>{' '}
            page to run a search.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(feeds.data ?? []).map((feed) => (
            <FeedCard key={`${feed.serverId}/${feed.libraryKey}`} feed={feed} />
          ))}
        </div>
      )}
    </div>
  );
}
