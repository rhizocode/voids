import { z } from 'zod';
import { scheduleConfigSchema } from '../enums/schedule';

/** Response for `GET /api/schedule` and `PUT /api/schedule`. */
export const scheduleResponseSchema = scheduleConfigSchema;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

/**
 * Body for `PUT /api/schedule`. Accepts the full schedule config; the server
 * normalizes it (preset cron is forced to match the chosen preset).
 */
export const updateScheduleRequestSchema = scheduleConfigSchema;
export type UpdateScheduleRequest = z.infer<typeof updateScheduleRequestSchema>;

/** One entry in the `GET /api/schedule/all` preset list. */
export const schedulePresetItemSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  cron: z.string(),
  enabled: z.boolean(),
});
export type SchedulePresetItem = z.infer<typeof schedulePresetItemSchema>;
export type SchedulePresetsResponse = SchedulePresetItem[];

/** Acknowledgement returned by `POST /api/schedule/run`. */
export type ScheduleRunResponse = { started: true };
