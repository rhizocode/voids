import { z } from 'zod';
import {
  notificationConfigSchema,
  notificationProviderConfigSchema,
  notificationProviderIdSchema,
} from '../domain/notifications';
import { notificationTypeSchema } from '../enums/notification-type';
import { payloadResultSchema } from './payload-result';

/** Response for `GET /api/notifications/:provider`. */
export const getNotificationResponseSchema = notificationProviderConfigSchema;
export type GetNotificationResponse = z.infer<typeof getNotificationResponseSchema>;

/** Response for `GET /api/notifications` (all providers). */
export const getNotificationsResponseSchema = z.array(notificationProviderConfigSchema);
export type GetNotificationsResponse = z.infer<typeof getNotificationsResponseSchema>;

/**
 * Body for `PUT /api/notifications/:provider`. The `config` is validated
 * against the discriminated union; the controller additionally checks that
 * `config.id` matches the `:provider` path parameter.
 */
export const updateNotificationRequestSchema = z.object({
  enabled: z.boolean(),
  config: notificationConfigSchema,
  notificationTypes: z.array(notificationTypeSchema),
});
export type UpdateNotificationRequest = z.infer<typeof updateNotificationRequestSchema>;

/** A single test result: the `{ code, reason }` Payload shape, with the provider id. */
export const testResultSchema = payloadResultSchema;
export type TestResult = z.infer<typeof testResultSchema>;

/** One entry of the `PUT /api/notifications/test-all` response array. */
export const providerTestResultSchema = payloadResultSchema.and(
  z.object({ id: notificationProviderIdSchema }),
);
export type ProviderTestResult = z.infer<typeof providerTestResultSchema>;
