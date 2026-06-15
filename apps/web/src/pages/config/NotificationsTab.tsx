import { useState } from 'react';
import {
  NOTIFICATION_PROVIDER_NAMES,
  Payload,
  type ProviderTestResult,
} from '@voids/shared';
import { useNotifications, useTestAll } from '../../api/hooks';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Spinner,
  StatusMessage,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../api/client';
import { NotificationProviderPanel } from './NotificationProviderPanel';

export function NotificationsTab() {
  const notifications = useNotifications();
  const testAll = useTestAll();
  const { toast } = useToast();

  const [results, setResults] = useState<ProviderTestResult[] | null>(null);

  async function onTestAll() {
    setResults(null);
    try {
      const res = await testAll.mutateAsync();
      setResults(res);
      if (res.length === 0) {
        toast('No enabled providers to test.', 'info');
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Test all failed.', 'error');
    }
  }

  if (notifications.isLoading) {
    return (
      <Card className="flex items-center gap-2 text-slate-400">
        <Spinner /> Loading notifications…
      </Card>
    );
  }

  const providers = notifications.data ?? [];

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure where Voids sends alerts. Enable a provider, fill in its
              settings, and choose which events it should notify on.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            onClick={onTestAll}
            disabled={testAll.isPending}
          >
            {testAll.isPending && <Spinner />}
            Test all
          </Button>
        </div>

        {results && results.length > 0 && (
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li key={r.id}>
                <StatusMessage
                  tone={
                    r.code === Payload.NOTIFICATION_TEST_SUCCEEDED.code ? 'success' : 'error'
                  }
                >
                  <span className="font-medium">{NOTIFICATION_PROVIDER_NAMES[r.id]}:</span>{' '}
                  {r.reason}
                </StatusMessage>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {providers.map((provider) => (
        <NotificationProviderPanel key={provider.id} provider={provider} />
      ))}
    </div>
  );
}
