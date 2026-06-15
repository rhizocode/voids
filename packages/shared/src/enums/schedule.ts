import { z } from 'zod';

/**
 * Preset cron schedules. NOTE: the `cron` values are Quartz 6-field cron
 * strings (as used by the original Gaps); a later phase converts them to
 * node-cron format. For now they are stored as data only.
 */
export interface SchedulePreset {
  readonly id: number;
  readonly label: string;
  readonly cron: string;
  readonly enabled: boolean;
}

export const Schedule = {
  HOURLY: { id: 0, label: 'Hourly', cron: '0 49 * * * ?', enabled: true },
  DAILY_4AM: { id: 1, label: 'Daily', cron: '0 0 4 * * ?', enabled: true },
  EVERY_MONDAY: { id: 2, label: 'Weekly', cron: '0 0 4 * * MON', enabled: true },
  EVERY_TWO_WEEKS: { id: 3, label: 'Bi-weekly', cron: '0 0 4 1,15 * ?', enabled: true },
  EVERY_MONTH: { id: 4, label: 'Monthly', cron: '0 0 4 1 * ?', enabled: true },
} as const satisfies Record<string, SchedulePreset>;

export type ScheduleName = keyof typeof Schedule;

export const schedulePresetIds = Object.values(Schedule).map((s) => s.id);

export function scheduleById(id: number): SchedulePreset | undefined {
  return Object.values(Schedule).find((s) => s.id === id);
}

/** The list of presets in id order, as exposed by `GET /api/schedule/all`. */
export const schedulePresets: readonly SchedulePreset[] = Object.values(Schedule).sort(
  (a, b) => a.id - b.id,
);

/**
 * The stored schedule configuration (brief §4.1). `cron` is ALWAYS the
 * effective Quartz 6-field expression: for `preset` mode it is a copy of the
 * chosen preset's cron; for `custom` mode it is the user's own string. The
 * scheduler converts this to node-cron format at registration time.
 *
 * - `enabled`  — whether the cron job is registered at all.
 * - `mode`     — `preset` (pick one of the built-in presets) or `custom`.
 * - `presetId` — the chosen preset id when `mode === 'preset'`, else `null`.
 * - `cron`     — the effective Quartz cron string (never empty).
 */
export const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['preset', 'custom']),
  presetId: z.number().int().nullable(),
  cron: z.string().min(1),
});

export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;

/**
 * Normalize a partial/loose schedule config into a consistent stored shape:
 * when `mode === 'preset'` and a valid `presetId` is given, the effective
 * `cron` is forced to match the preset (the source of truth). Custom mode keeps
 * the caller's cron. Throws on an unknown preset id or a missing custom cron.
 */
export function resolveScheduleConfig(input: ScheduleConfig): ScheduleConfig {
  if (input.mode === 'preset') {
    if (input.presetId == null) {
      throw new Error('preset mode requires a presetId');
    }
    const preset = scheduleById(input.presetId);
    if (!preset) {
      throw new Error(`Unknown schedule preset id: ${input.presetId}`);
    }
    return { enabled: input.enabled, mode: 'preset', presetId: preset.id, cron: preset.cron };
  }
  if (!input.cron || input.cron.trim() === '') {
    throw new Error('custom mode requires a cron string');
  }
  return { enabled: input.enabled, mode: 'custom', presetId: null, cron: input.cron.trim() };
}
