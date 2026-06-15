import { useVersion } from '../api/hooks';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui';

export function AboutPage() {
  const version = useVersion();

  return (
    <div>
      <PageHeader title="About" />
      <Card className="space-y-4 text-sm leading-relaxed text-slate-300">
        <p>
          <span className="font-semibold text-white">Voids</span> finds the gaps in your movie
          collections — the missing sequels and collection entries you don&apos;t own yet — by
          scanning your media server (Jellyfin) and cross-referencing TMDB.
        </p>
        <p>
          Voids is a TypeScript reimplementation inspired by{' '}
          <a
            className="text-indigo-400 underline hover:text-indigo-300"
            href="https://github.com/JasonHHouse/gaps"
            target="_blank"
            rel="noreferrer"
          >
            Gaps
          </a>{' '}
          by Jason H House, used under the MIT License.
        </p>
        <p className="text-slate-400">
          App version:{' '}
          <span className="font-mono text-slate-200">
            {version.isLoading ? 'loading…' : (version.data?.version ?? 'unknown')}
          </span>
        </p>
      </Card>
    </div>
  );
}
