import { Link } from 'react-router-dom';
import { useServers, useSettings } from '../api/hooks';
import { PageHeader } from '../components/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Spinner,
} from '../components/ui';

function StatCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardTitle className="text-base">{title}</CardTitle>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function StatusPage() {
  const settings = useSettings();
  const servers = useServers();

  const tmdbConfigured = Boolean(settings.data?.tmdbApiKey);

  const serverList = servers.data ?? [];
  const movieLibraries = serverList.flatMap((s) =>
    s.libraries.filter((l) => l.collectionType === 'movies' || l.type === 'movie'),
  );
  const enabledMovieLibraries = movieLibraries.filter((l) => l.enabled);

  const loading = settings.isLoading || servers.isLoading;

  return (
    <div>
      <PageHeader title="Status" subtitle="An overview of your Voids configuration." />

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner /> Loading status…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="TMDB">
            {tmdbConfigured ? (
              <Badge tone="success">Configured</Badge>
            ) : (
              <Badge tone="warning">Not configured</Badge>
            )}
            <CardDescription>
              {tmdbConfigured
                ? 'A TMDB API key is saved.'
                : 'Add a TMDB API key to enable searches.'}
            </CardDescription>
          </StatCard>

          <StatCard title="Media servers">
            <div className="text-3xl font-bold text-white">{serverList.length}</div>
            <CardDescription>
              {serverList.length === 0
                ? 'No media servers added yet.'
                : serverList.map((s) => s.name).join(', ')}
            </CardDescription>
          </StatCard>

          <StatCard title="Movie libraries">
            <div className="text-3xl font-bold text-white">
              {enabledMovieLibraries.length}
              <span className="text-lg font-normal text-slate-500">
                {' / '}
                {movieLibraries.length}
              </span>
            </div>
            <CardDescription>enabled / total</CardDescription>
          </StatCard>
        </div>
      )}

      {!loading && enabledMovieLibraries.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Movie libraries</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {enabledMovieLibraries.map((lib) => {
              const server = serverList.find((s) => s.id === lib.serverId);
              return (
                <Card key={`${lib.serverId}:${lib.key}`} className="flex flex-col gap-2">
                  <div>
                    <div className="font-medium text-slate-100">{lib.title}</div>
                    <CardDescription>{server?.name ?? lib.serverId}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/libraries">
                      <Button size="sm" variant="secondary">
                        Browse owned
                      </Button>
                    </Link>
                    <Link to="/recommended">
                      <Button size="sm" variant="secondary">
                        View voids
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/config">
          <Button>Go to Configuration</Button>
        </Link>
        <Link to="/config">
          <Button variant="secondary">Add a media server</Button>
        </Link>
      </div>
    </div>
  );
}
