import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateNetworkRequestSchema, type UpdateNetworkRequest } from '@voids/shared';
import { useNetworkSettings, useUpdateNetworkSettings } from '../../api/hooks';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Label,
  Spinner,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../api/client';

export function NetworkTab() {
  const network = useNetworkSettings();
  const update = useUpdateNetworkSettings();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateNetworkRequest>({
    resolver: zodResolver(updateNetworkRequestSchema),
    defaultValues: { connectTimeoutMs: 10000, readTimeoutMs: 30000 },
  });

  // Seed the form once the server settings load. Guarded so a later re-render
  // (e.g. after a failed validation submit) never clobbers the user's edits.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && network.data) {
      reset(network.data);
      seeded.current = true;
    }
  }, [network.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      reset(saved);
      toast('Network settings saved.', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to save network settings.', 'error');
    }
  });

  if (network.isLoading) {
    return (
      <Card className="flex items-center gap-2 text-slate-400">
        <Spinner /> Loading network settings…
      </Card>
    );
  }

  return (
    <form className="max-w-xl space-y-4" onSubmit={onSubmit}>
      <Card>
        <CardTitle>HTTP timeouts</CardTitle>
        <CardDescription>
          Applied to Jellyfin, TMDB, and Radarr requests. Increase these if you have a large or
          slow library; lower them to fail fast on an unreachable server.
        </CardDescription>

        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="connect-timeout">Connect timeout (ms)</Label>
            <Input
              id="connect-timeout"
              type="number"
              inputMode="numeric"
              className="mt-1"
              min={100}
              max={600000}
              {...register('connectTimeoutMs', { valueAsNumber: true })}
            />
            <p className="mt-1 text-xs text-slate-400">
              How long to wait to establish a connection. Between 100ms and 600000ms (10 min).
            </p>
            {errors.connectTimeoutMs && (
              <p className="mt-1 text-xs text-red-400">{errors.connectTimeoutMs.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="read-timeout">Read timeout (ms)</Label>
            <Input
              id="read-timeout"
              type="number"
              inputMode="numeric"
              className="mt-1"
              min={100}
              max={600000}
              {...register('readTimeoutMs', { valueAsNumber: true })}
            />
            <p className="mt-1 text-xs text-slate-400">
              How long to wait for a response once connected. Between 100ms and 600000ms (10 min).
            </p>
            {errors.readTimeoutMs && (
              <p className="mt-1 text-xs text-red-400">{errors.readTimeoutMs.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={update.isPending || !isDirty}>
              {update.isPending && <Spinner />}
              Save
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
