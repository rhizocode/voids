import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addServerRequestSchema, type AddServerRequest } from '@voids/shared';
import { useAddServer } from '../../api/hooks';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Label,
  Select,
  Spinner,
  StatusMessage,
  Switch,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../api/client';

export function AddServerForm() {
  const addServer = useAddServer();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AddServerRequest>({
    resolver: zodResolver(addServerRequestSchema),
    defaultValues: {
      type: 'jellyfin',
      address: '',
      port: 8096,
      useHttps: false,
      token: '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      const created = await addServer.mutateAsync(data);
      toast(`Added ${created.name}.`, 'success');
      reset();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add media server.');
    }
  });

  return (
    <Card className="max-w-xl">
      <CardTitle>Add media server</CardTitle>
      <CardDescription>
        Voids tests the connection before saving. The default type is Jellyfin.
      </CardDescription>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <Label htmlFor="server-type">Type</Label>
          <Select id="server-type" {...register('type')}>
            <option value="jellyfin">Jellyfin</option>
            <option value="plex" disabled>
              Plex (coming soon)
            </option>
          </Select>
          {errors.type && <p className="mt-1 text-xs text-red-400">{errors.type.message}</p>}
        </div>

        <div>
          <Label htmlFor="server-address">Address</Label>
          <Input id="server-address" placeholder="e.g. 192.168.1.10" {...register('address')} />
          {errors.address && (
            <p className="mt-1 text-xs text-red-400">{errors.address.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="server-port">Port</Label>
          <Input
            id="server-port"
            type="number"
            {...register('port', { valueAsNumber: true })}
          />
          {errors.port && <p className="mt-1 text-xs text-red-400">{errors.port.message}</p>}
        </div>

        <div className="flex items-center gap-3">
          <Controller
            control={control}
            name="useHttps"
            render={({ field }) => (
              <Switch
                id="server-https"
                aria-label="Use HTTPS"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="server-https" className="mb-0">
            Use HTTPS
          </Label>
        </div>

        <div>
          <Label htmlFor="server-token">API key</Label>
          <Input
            id="server-token"
            type="password"
            autoComplete="off"
            placeholder="Media server API key / token"
            {...register('token')}
          />
          {errors.token && <p className="mt-1 text-xs text-red-400">{errors.token.message}</p>}
        </div>

        <Button type="submit" disabled={addServer.isPending}>
          {addServer.isPending && <Spinner />}
          Add media server
        </Button>

        {error && <StatusMessage tone="error">{error}</StatusMessage>}
      </form>
    </Card>
  );
}
