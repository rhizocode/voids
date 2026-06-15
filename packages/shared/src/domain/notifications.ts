import { z } from 'zod';
import { notificationTypeSchema, type NotificationType } from '../enums/notification-type';

/**
 * Notification providers, ported from Gaps with their STABLE numeric ids
 * preserved for UI parity. Do NOT renumber.
 */
export const NotificationProviderId = {
  TELEGRAM: 0,
  PUSHBULLET: 1,
  SLACK: 2,
  GOTIFY: 3,
  EMAIL: 4,
  PUSHOVER: 5,
  DISCORD: 6,
} as const;

export type NotificationProviderId =
  (typeof NotificationProviderId)[keyof typeof NotificationProviderId];

/** Human-readable names keyed by stable id. */
export const NOTIFICATION_PROVIDER_NAMES: Record<NotificationProviderId, string> = {
  [NotificationProviderId.TELEGRAM]: 'Telegram',
  [NotificationProviderId.PUSHBULLET]: 'PushBullet',
  [NotificationProviderId.SLACK]: 'Slack',
  [NotificationProviderId.GOTIFY]: 'Gotify',
  [NotificationProviderId.EMAIL]: 'Email',
  [NotificationProviderId.PUSHOVER]: 'PushOver',
  [NotificationProviderId.DISCORD]: 'Discord',
};

export const notificationProviderIdSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

/**
 * Per-provider config schemas. Field names mirror the original Gaps
 * properties (gaps-reference §6) so behavior is faithful. Each carries a
 * literal `id` discriminant so the union below is strongly typed.
 */

// 0. Telegram — bot token + chat id.
export const telegramConfigSchema = z.object({
  id: z.literal(NotificationProviderId.TELEGRAM),
  botId: z.string().default(''),
  chatId: z.string().default(''),
});
export type TelegramConfig = z.infer<typeof telegramConfigSchema>;

// 1. PushBullet — access token (+ optional channel tag for routing).
export const pushBulletConfigSchema = z.object({
  id: z.literal(NotificationProviderId.PUSHBULLET),
  accessToken: z.string().default(''),
  channelTag: z.string().default(''),
});
export type PushBulletConfig = z.infer<typeof pushBulletConfigSchema>;

// 2. Slack — incoming webhook URL.
export const slackConfigSchema = z.object({
  id: z.literal(NotificationProviderId.SLACK),
  webHookUrl: z.string().default(''),
});
export type SlackConfig = z.infer<typeof slackConfigSchema>;

// 3. Gotify — server base URL + app/message token + priority.
export const gotifyConfigSchema = z.object({
  id: z.literal(NotificationProviderId.GOTIFY),
  address: z.string().default(''),
  token: z.string().default(''),
  priority: z.number().int().default(5),
});
export type GotifyConfig = z.infer<typeof gotifyConfigSchema>;

// 4. Email — SMTP (nodemailer).
export const emailConfigSchema = z.object({
  id: z.literal(NotificationProviderId.EMAIL),
  username: z.string().default(''),
  password: z.string().default(''),
  mailTo: z.string().default(''),
  mailFrom: z.string().default(''),
  mailServer: z.string().default(''),
  mailPort: z.number().int().default(587),
  mailSmtpAuth: z.boolean().default(true),
  mailSmtpTlsEnabled: z.boolean().default(true),
});
export type EmailConfig = z.infer<typeof emailConfigSchema>;

// 5. PushOver — user token + api token (+ optional priority/sound/retry/expire).
export const pushOverConfigSchema = z.object({
  id: z.literal(NotificationProviderId.PUSHOVER),
  token: z.string().default(''),
  user: z.string().default(''),
  priority: z.number().int().default(0),
  sound: z.string().default(''),
  retry: z.number().int().default(60),
  expire: z.number().int().default(3600),
});
export type PushOverConfig = z.infer<typeof pushOverConfigSchema>;

// 6. Discord — incoming webhook URL.
export const discordConfigSchema = z.object({
  id: z.literal(NotificationProviderId.DISCORD),
  webHookUrl: z.string().default(''),
});
export type DiscordConfig = z.infer<typeof discordConfigSchema>;

/**
 * Discriminated union of every provider config, keyed by the stable `id`.
 * Selecting on `id` narrows to the exact provider shape.
 */
export const notificationConfigSchema = z.discriminatedUnion('id', [
  telegramConfigSchema,
  pushBulletConfigSchema,
  slackConfigSchema,
  gotifyConfigSchema,
  emailConfigSchema,
  pushOverConfigSchema,
  discordConfigSchema,
]);
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;

/**
 * One provider's full stored record: identity, name, enabled flag, the typed
 * config, and the set of `NotificationType`s it subscribes to.
 */
export const notificationProviderConfigSchema = z.object({
  id: notificationProviderIdSchema,
  name: z.string(),
  enabled: z.boolean(),
  config: notificationConfigSchema,
  notificationTypes: z.array(notificationTypeSchema),
});
export type NotificationProviderConfig = z.infer<typeof notificationProviderConfigSchema>;

/** Default config object for a provider id (all fields at their schema defaults). */
export function defaultNotificationConfig(id: NotificationProviderId): NotificationConfig {
  switch (id) {
    case NotificationProviderId.TELEGRAM:
      return telegramConfigSchema.parse({ id });
    case NotificationProviderId.PUSHBULLET:
      return pushBulletConfigSchema.parse({ id });
    case NotificationProviderId.SLACK:
      return slackConfigSchema.parse({ id });
    case NotificationProviderId.GOTIFY:
      return gotifyConfigSchema.parse({ id });
    case NotificationProviderId.EMAIL:
      return emailConfigSchema.parse({ id });
    case NotificationProviderId.PUSHOVER:
      return pushOverConfigSchema.parse({ id });
    case NotificationProviderId.DISCORD:
      return discordConfigSchema.parse({ id });
  }
}

/** All `NotificationType`s — the sensible default subscription for a fresh provider. */
export const allNotificationTypes: NotificationType[] = notificationTypeSchema.options;
