import { useState } from 'react';
import type { MediaServerView, MediaLibrary, PayloadResult } from '@voids/shared';
import { Payload } from '@voids/shared';
import { useDeleteServer, useTestServer, useToggleLibrary } from '../../api/hooks';
import {
  Badge,
  Button,
  Card,
  PayloadStatus,
  Spinner,
  StatusMessage,
  Switch,
} from '../../components/ui';
import { ApiError } from '../../api/client';

function LibraryRow({ serverId, library }: { serverId: string; library: MediaLibrary }) {
  const toggle = useToggleLibrary();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-200">{library.title}</div>
        <div className="text-xs text-slate-500">{library.collectionType ?? library.type}</div>
      </div>
      <div className="flex items-center gap-5">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Enabled
          <Switch
            aria-label={`Enable ${library.title}`}
            checked={library.enabled}
            disabled={toggle.isPending}
            onCheckedChange={(enabled) =>
              toggle.mutate({ serverId, key: library.key, body: { enabled } })
            }
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Default
          <Switch
            aria-label={`Set ${library.title} as default`}
            checked={library.isDefault}
            disabled={toggle.isPending}
            onCheckedChange={(isDefault) =>
              toggle.mutate({ serverId, key: library.key, body: { isDefault } })
            }
          />
        </label>
      </div>
    </div>
  );
}

export function ServerCard({ server }: { server: MediaServerView }) {
  const testServer = useTestServer();
  const deleteServer = useDeleteServer();
  const [testResult, setTestResult] = useState<PayloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setError(null);
    setTestResult(null);
    try {
      const res = await testServer.mutateAsync(server.id);
      setTestResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Connection test failed.');
    }
  }

  async function remove() {
    if (!window.confirm(`Delete media server "${server.name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteServer.mutateAsync(server.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Delete failed.');
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-white">{server.name}</h4>
            <Badge tone="info" className="uppercase">
              {server.type}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-slate-400">
            {server.useHttps ? 'https' : 'http'}://{server.address}:{server.port}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={runTest}
            disabled={testServer.isPending}
          >
            {testServer.isPending && <Spinner />}
            Test connection
          </Button>
          <Button variant="danger" size="sm" onClick={remove} disabled={deleteServer.isPending}>
            Delete
          </Button>
        </div>
      </div>

      {testResult && (
        <PayloadStatus
          className="mt-3"
          result={testResult}
          successCodes={[Payload.PLEX_CONNECTION_SUCCEEDED.code]}
        />
      )}
      {error && (
        <StatusMessage tone="error" className="mt-3">
          {error}
        </StatusMessage>
      )}

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Libraries
        </div>
        {server.libraries.length === 0 ? (
          <p className="text-sm text-slate-500">No libraries found.</p>
        ) : (
          <div className="space-y-2">
            {server.libraries.map((lib) => (
              <LibraryRow key={lib.key} serverId={server.id} library={lib} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
