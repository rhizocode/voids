import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tmdbKeyRequestSchema, type TmdbKeyRequest, type PayloadResult } from '@voids/shared';
import { Payload } from '@voids/shared';
import { useSettings, useTmdbTest, useSaveTmdbKey } from '../../api/hooks';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Label,
  PayloadStatus,
  Spinner,
  StatusMessage,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../api/client';

export function TmdbTab() {
  const settings = useSettings();
  const tmdbTest = useTmdbTest();
  const saveKey = useSaveTmdbKey();
  const { toast } = useToast();

  const [result, setResult] = useState<PayloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(settings.data?.tmdbApiKey);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<TmdbKeyRequest>({
    resolver: zodResolver(tmdbKeyRequestSchema),
    defaultValues: { apiKey: '' },
  });

  async function runTest() {
    setError(null);
    setResult(null);
    const apiKey = getValues('apiKey');
    if (!apiKey) {
      setError('Enter an API key to test.');
      return;
    }
    try {
      const res = await tmdbTest.mutateAsync({ apiKey });
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Test request failed.');
    }
  }

  const onSave = handleSubmit(async (data) => {
    setError(null);
    setResult(null);
    try {
      const res = await saveKey.mutateAsync(data);
      setResult(res);
      toast('TMDB key saved.', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Save request failed.');
    }
  });

  return (
    <Card className="max-w-xl">
      <CardTitle>TMDB API key</CardTitle>
      <CardDescription>
        Voids uses The Movie Database to find collection siblings. Get a free API key at
        themoviedb.org.
      </CardDescription>

      <form onSubmit={onSave} className="mt-5 space-y-4">
        <div>
          <Label htmlFor="tmdb-key">API key</Label>
          <Input
            id="tmdb-key"
            type="password"
            autoComplete="off"
            placeholder={
              settings.isLoading
                ? 'loading…'
                : configured
                  ? '•••••••••••••••• (saved — enter a new key to replace)'
                  : 'Enter your TMDB API key'
            }
            {...register('apiKey')}
          />
          {errors.apiKey && (
            <p className="mt-1 text-xs text-red-400">{errors.apiKey.message}</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={runTest}
            disabled={tmdbTest.isPending}
          >
            {tmdbTest.isPending && <Spinner />}
            Test
          </Button>
          <Button type="submit" disabled={saveKey.isPending}>
            {saveKey.isPending && <Spinner />}
            Save
          </Button>
        </div>

        {result && (
          <PayloadStatus
            result={result}
            successCodes={[Payload.TMDB_KEY_VALID.code, Payload.TMDB_KEY_SAVE_SUCCESSFUL.code]}
          />
        )}
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
      </form>
    </Card>
  );
}
