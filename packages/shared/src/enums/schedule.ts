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

/**
 * A schedule selection: either one of the presets (by id) or a custom cron
 * string. `cron` always carries the effective cron expression.
 */
export const scheduleSelectionSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  cron: z.string(),
  enabled: z.boolean(),
  custom: z.boolean().default(false),
});

export type ScheduleSelection = z.infer<typeof scheduleSelectionSchema>;
