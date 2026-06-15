import { useEffect, useState } from 'react';
import {
  Payload,
  radarrConfigSchema,
  type RadarrConfig,
  type RadarrQualityProfile,
  type RadarrRootFolder,
} from '@voids/shared';
import {
  useSettings,
  useUpdateSettings,
  useTestRadarr,
  useRadarrQualityProfiles,
  useRadarrRootFolders,
} from '../../api/hooks';
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Label,
  Select,
  Spinner,
  Switch,
  useToast,
} from '../../components/ui';
import { ApiError } from '../../api/client';

const AVAILABILITY_OPTIONS = [
  { value: 'announced', label: 'Announced' },
  { value: 'inCinemas', label: 'In Cinemas' },
  { value: 'released', label: 'Released' },
] as const;

/** Default draft for an unconfigured Radarr (matches the shared schema defaults). */
const EMPTY_DRAFT: RadarrConfig = {
  url: '',
  apiKey: '',
  qualityProfileId: null,
  rootFolderPath: null,
  monitored: true,
  minimumAvailability: 'released',
  searchOnAdd: true,
};

export function RadarrTab() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const testRadarr = useTestRadarr();
  const profiles = useRadarrQualityProfiles();
  const folders = useRadarrRootFolders();
  const { toast } = useToast();

  const [draft, setDraft] = useState<RadarrConfig>(EMPTY_DRAFT);
  const [autoPush, setAutoPush] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Seed the local draft once settings load.
  useEffect(() => {
    if (seeded || !settings.data) return;
    setDraft(settings.data.radarr ?? EMPTY_DRAFT);
    setAutoPush(settings.data.autoPushRadarr);
    setSeeded(true);
  }, [settings.data, seeded]);

  const profileList: RadarrQualityProfile[] = profiles.data ?? [];
  const folderList: RadarrRootFolder[] = folders.data ?? [];

  const set = <K extends keyof RadarrConfig>(key: K, value: RadarrConfig[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function onTest() {
    try {
      const res = await testRadarr.mutateAsync();
      const ok = res.code === Payload.RADARR_CONNECTION_SUCCEEDED.code;
      toast(res.reason, ok ? 'success' : 'error');
      if (ok) {
        // A working connection means profiles/folders are now fetchable.
        void profiles.refetch();
        void folders.refetch();
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Radarr test failed.', 'error');
    }
  }

  async function onSave() {
    const parsed = radarrConfigSchema.safeParse(draft);
    if (!parsed.success) {
      toast('Fix the Radarr config before saving.', 'error');
      return;
    }
    try {
      await updateSettings.mutateAsync({ radarr: parsed.data, autoPushRadarr: autoPush });
      toast('Radarr settings saved.', 'success');
      // Lists may now be reachable with the saved credentials.
      void profiles.refetch();
      void folders.refetch();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to save Radarr settings.', 'error');
    }
  }

  if (settings.isLoading) {
    return (
      <Card className="flex items-center gap-2 text-slate-400">
        <Spinner /> Loading settings…
      </Card>
    );
  }

  const listsEmpty = profileList.length === 0 && folderList.length === 0;

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardTitle>Radarr</CardTitle>
        <CardDescription>
          Connect Radarr to push approved gaps as movies. Enter the URL and API key, test the
          connection, then save.
        </CardDescription>

        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="radarr-url">URL</Label>
            <Input
              id="radarr-url"
              className="mt-1"
              placeholder="http://localhost:7878"
              value={draft.url}
              onChange={(e) => set('url', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="radarr-apikey">API key</Label>
            <Input
              id="radarr-apikey"
              className="mt-1"
              type="password"
              autoComplete="off"
              placeholder="Radarr API key"
              value={draft.apiKey}
              onChange={(e) => set('apiKey', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="radarr-quality-profile">Quality profile</Label>
            {profileList.length > 0 ? (
              <Select
                id="radarr-quality-profile"
                className="mt-1"
                value={draft.qualityProfileId ?? ''}
                onChange={(e) =>
                  set('qualityProfileId', e.target.value === '' ? null : Number(e.target.value))
                }
              >
                <option value="">Select a profile…</option>
                {profileList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id="radarr-quality-profile"
                className="mt-1"
                type="number"
                placeholder="Quality profile id"
                value={draft.qualityProfileId ?? ''}
                onChange={(e) =>
                  set('qualityProfileId', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            )}
          </div>

          <div>
            <Label htmlFor="radarr-root-folder">Root folder</Label>
            {folderList.length > 0 ? (
              <Select
                id="radarr-root-folder"
                className="mt-1"
                value={draft.rootFolderPath ?? ''}
                onChange={(e) =>
                  set('rootFolderPath', e.target.value === '' ? null : e.target.value)
                }
              >
                <option value="">Select a folder…</option>
                {folderList.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.path}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id="radarr-root-folder"
                className="mt-1"
                placeholder="/movies"
                value={draft.rootFolderPath ?? ''}
                onChange={(e) =>
                  set('rootFolderPath', e.target.value === '' ? null : e.target.value)
                }
              />
            )}
          </div>

          {listsEmpty && (
            <p className="text-xs text-slate-400">
              Test the connection or save your credentials to populate quality profiles and root
              folders. Until then, you can enter them manually.
            </p>
          )}

          <div>
            <Label htmlFor="radarr-availability">Minimum availability</Label>
            <Select
              id="radarr-availability"
              className="mt-1"
              value={draft.minimumAvailability}
              onChange={(e) => set('minimumAvailability', e.target.value)}
            >
              {AVAILABILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="radarr-monitored">Monitored</Label>
              <p className="mt-1 text-xs text-slate-400">Add movies as monitored in Radarr.</p>
            </div>
            <Switch
              id="radarr-monitored"
              aria-label="Add movies as monitored"
              checked={draft.monitored}
              onCheckedChange={(v) => set('monitored', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="radarr-search-on-add">Search on add</Label>
              <p className="mt-1 text-xs text-slate-400">
                Trigger an automatic search when a movie is added.
              </p>
            </div>
            <Switch
              id="radarr-search-on-add"
              aria-label="Search on add"
              checked={draft.searchOnAdd}
              onCheckedChange={(v) => set('searchOnAdd', v)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onTest}
              disabled={testRadarr.isPending}
            >
              {testRadarr.isPending && <Spinner />}
              Test connection
            </Button>
            <Button type="button" onClick={onSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Spinner />}
              Save
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Automatic push</CardTitle>
        <CardDescription>Push approved gaps to Radarr on scheduled runs.</CardDescription>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <Label htmlFor="radarr-auto-push">Auto-push to Radarr</Label>
            <p className="mt-1 text-xs text-slate-400">
              Automatically push approved gaps to Radarr on scheduled runs.
            </p>
          </div>
          <Switch
            id="radarr-auto-push"
            aria-label="Automatically push approved gaps to Radarr on scheduled runs"
            checked={autoPush}
            onCheckedChange={setAutoPush}
          />
        </div>
      </Card>
    </div>
  );
}
