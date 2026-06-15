import { useEffect, useState } from 'react';
import {
  MovieStatus,
  type ScheduleConfig,
  type SchedulePresetItem,
} from '@voids/shared';
import {
  useSchedule,
  useSchedulePresets,
  useUpdateSchedule,
  useRunScheduleNow,
  useMovieStatus,
  useUpdateMovieStatus,
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
import { cn } from '../../components/ui/cn';
import { ApiError } from '../../api/client';

/**
 * Rough human hint for a Quartz 6-field cron (`sec min hour dom month dow`).
 * Best-effort only — we map the built-in presets and a few common shapes, and
 * otherwise fall back to the raw expression so the UI never lies.
 */
function cronHint(cron: string): string {
  const trimmed = cron.trim();
  switch (trimmed) {
    case '0 49 * * * ?':
      return 'Every hour, at 49 minutes past';
    case '0 0 4 * * ?':
      return 'Every day at 4:00 AM';
    case '0 0 4 * * MON':
      return 'Every Monday at 4:00 AM';
    case '0 0 4 1,15 * ?':
      return 'On the 1st and 15th of each month at 4:00 AM';
    case '0 0 4 1 * ?':
      return 'On the 1st of each month at 4:00 AM';
    default:
      return trimmed;
  }
}

/** Validate a Quartz 6-field cron string: non-empty, roughly six fields. */
function isLikelyCron(cron: string): boolean {
  const fields = cron.trim().split(/\s+/);
  return fields.length === 6 && fields.every((f) => f.length > 0);
}

const RELEASED = MovieStatus.RELEASED.id; // 1
const ALL = MovieStatus.ALL.id; // 0

export function ScheduleTab() {
  const schedule = useSchedule();
  const presets = useSchedulePresets();
  const movieStatus = useMovieStatus();
  const updateSchedule = useUpdateSchedule();
  const runNow = useRunScheduleNow();
  const updateMovieStatus = useUpdateMovieStatus();
  const { toast } = useToast();

  // Local draft state, seeded from the server config once it loads.
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<ScheduleConfig['mode']>('preset');
  const [presetId, setPresetId] = useState<number | null>(null);
  const [customCron, setCustomCron] = useState('');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || !schedule.data) return;
    const c = schedule.data;
    setEnabled(c.enabled);
    setMode(c.mode);
    setPresetId(c.presetId);
    if (c.mode === 'custom') setCustomCron(c.cron);
    setSeeded(true);
  }, [schedule.data, seeded]);

  const presetList: SchedulePresetItem[] = presets.data ?? [];
  const selectedPreset = presetList.find((p) => p.id === presetId) ?? null;

  // The effective cron mirrors what the server will store.
  const effectiveCron =
    mode === 'preset' ? (selectedPreset?.cron ?? '') : customCron.trim();

  const customInvalid = mode === 'custom' && !isLikelyCron(customCron);
  const presetMissing = mode === 'preset' && selectedPreset == null;
  const canSave = !customInvalid && !presetMissing && !updateSchedule.isPending;

  async function onSave() {
    if (!canSave) return;
    const body: ScheduleConfig = {
      enabled,
      mode,
      presetId: mode === 'preset' ? (presetId as number) : null,
      cron: effectiveCron,
    };
    try {
      await updateSchedule.mutateAsync(body);
      toast('Schedule saved.', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to save schedule.', 'error');
    }
  }

  async function onRunNow() {
    try {
      await runNow.mutateAsync();
      toast(
        'Started a full search run. It runs in the background — watch progress on the Recommended page.',
        'success',
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to start a search run.', 'error');
    }
  }

  async function onToggleMovieStatus(releasedOnly: boolean) {
    const next = releasedOnly ? RELEASED : ALL;
    try {
      await updateMovieStatus.mutateAsync({ movieStatus: next });
      toast(
        releasedOnly
          ? 'Now recommending released movies only.'
          : 'Now recommending all movies, including unreleased.',
        'success',
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to update search options.', 'error');
    }
  }

  if (schedule.isLoading) {
    return (
      <Card className="flex items-center gap-2 text-slate-400">
        <Spinner /> Loading schedule…
      </Card>
    );
  }

  const releasedOnly = movieStatus.data?.id === RELEASED;

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardTitle>Automation schedule</CardTitle>
        <CardDescription>
          Run a full search across your enabled libraries on a recurring schedule.
        </CardDescription>

        <div className="mt-5 space-y-5">
          {/* Enabled */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="schedule-enabled">Enabled</Label>
              <p className="mt-1 text-xs text-slate-400">
                Turn automated searches on or off.
              </p>
            </div>
            <Switch
              id="schedule-enabled"
              aria-label="Enable automated searches"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Mode */}
          <div>
            <Label>Mode</Label>
            <div className="mt-2 inline-flex rounded-md border border-slate-700 p-0.5">
              <button
                type="button"
                aria-pressed={mode === 'preset'}
                onClick={() => setMode('preset')}
                className={cn(
                  'rounded px-3 py-1 text-sm transition-colors',
                  mode === 'preset'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800',
                )}
              >
                Preset
              </button>
              <button
                type="button"
                aria-pressed={mode === 'custom'}
                onClick={() => setMode('custom')}
                className={cn(
                  'rounded px-3 py-1 text-sm transition-colors',
                  mode === 'custom'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800',
                )}
              >
                Custom cron
              </button>
            </div>
          </div>

          {/* Preset mode */}
          {mode === 'preset' && (
            <div>
              <Label htmlFor="schedule-preset">Preset</Label>
              <Select
                id="schedule-preset"
                className="mt-1"
                value={presetId ?? ''}
                onChange={(e) =>
                  setPresetId(e.target.value === '' ? null : Number(e.target.value))
                }
              >
                <option value="">Select a preset…</option>
                {presetList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {cronHint(p.cron)}
                  </option>
                ))}
              </Select>
              {presetMissing && (
                <p className="mt-1 text-xs text-red-400">Choose a preset.</p>
              )}
            </div>
          )}

          {/* Custom mode */}
          {mode === 'custom' && (
            <div>
              <Label htmlFor="schedule-cron">Custom cron (Quartz, 6 fields)</Label>
              <Input
                id="schedule-cron"
                className="mt-1 font-mono"
                placeholder="0 0 4 * * ?"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Format: <code>sec min hour day-of-month month day-of-week</code>. Example:{' '}
                <code>0 0 4 * * ?</code> runs daily at 4:00 AM.
              </p>
              {customInvalid && (
                <p className="mt-1 text-xs text-red-400">
                  Enter a 6-field cron expression.
                </p>
              )}
            </div>
          )}

          {/* Effective cron (read-only) */}
          <div>
            <Label htmlFor="schedule-effective">Effective cron</Label>
            <Input
              id="schedule-effective"
              className="mt-1 font-mono"
              readOnly
              value={effectiveCron}
            />
            {effectiveCron && (
              <p className="mt-1 text-xs text-slate-400">{cronHint(effectiveCron)}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={onSave} disabled={!canSave}>
              {updateSchedule.isPending && <Spinner />}
              Save
            </Button>
            <Button variant="secondary" onClick={onRunNow} disabled={runNow.isPending}>
              {runNow.isPending && <Spinner />}
              Run search now
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Search options</CardTitle>
        <CardDescription>Tune what counts as a recommendable void.</CardDescription>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <Label htmlFor="movie-status">Recommend only released movies</Label>
            <p className="mt-1 text-xs text-slate-400">
              On: only released movies are recommended. Off: include unreleased and
              announced movies.
            </p>
          </div>
          <Switch
            id="movie-status"
            aria-label="Recommend only released movies"
            checked={releasedOnly}
            disabled={movieStatus.isLoading || updateMovieStatus.isPending}
            onCheckedChange={onToggleMovieStatus}
          />
        </div>
      </Card>
    </div>
  );
}
