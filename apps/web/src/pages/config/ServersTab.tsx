import { useServers } from '../../api/hooks';
import { Card, Spinner, StatusMessage } from '../../components/ui';
import { ServerCard } from './ServerCard';
import { AddServerForm } from './AddServerForm';

export function ServersTab() {
  const servers = useServers();

  return (
    <div className="space-y-6">
      {servers.isLoading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner /> Loading media servers…
        </div>
      ) : servers.isError ? (
        <StatusMessage tone="error">Failed to load media servers.</StatusMessage>
      ) : servers.data && servers.data.length > 0 ? (
        <div className="space-y-4">
          {servers.data.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      ) : (
        <Card className="text-sm text-slate-400">
          No media servers configured yet. Add one below.
        </Card>
      )}

      <AddServerForm />
    </div>
  );
}
