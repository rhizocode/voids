import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  NOTIFICATION_PROVIDER_NAMES,
  NotificationProviderId,
  allNotificationTypes,
  defaultNotificationConfig,
  notificationProviderConfigSchema,
  type NotificationConfig,
  type NotificationProviderConfig,
  type NotificationType,
} from '@voids/shared';
import { DB } from '../db.module';
import type { DbHandle } from '../client';
import { notificationProviders } from '../schema';

type ProviderRow = typeof notificationProviders.$inferSelect;

/** The seven stable provider ids, in catalog order. */
const PROVIDER_IDS: NotificationProviderId[] = [
  NotificationProviderId.TELEGRAM,
  NotificationProviderId.PUSHBULLET,
  NotificationProviderId.SLACK,
  NotificationProviderId.GOTIFY,
  NotificationProviderId.EMAIL,
  NotificationProviderId.PUSHOVER,
  NotificationProviderId.DISCORD,
];

function toConfig(row: ProviderRow): NotificationProviderConfig {
  const id = row.id as NotificationProviderId;
  // Tolerate empty/partial stored config by falling back to defaults.
  const rawConfig = (row.config as NotificationConfig | null) ?? defaultNotificationConfig(id);
  const types = (row.notificationTypes as NotificationType[] | null) ?? [];
  return notificationProviderConfigSchema.parse({
    id,
    name: row.name,
    enabled: row.enabled,
    config: { ...rawConfig, id },
    notificationTypes: types,
  });
}

/** Repository + first-boot seeding for the `notification_providers` table. */
@Injectable()
export class NotificationRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  private get db() {
    return this.handle.db;
  }

  /** Seed the 7 provider rows (disabled, default config, all types) if absent. */
  seed(): void {
    for (const id of PROVIDER_IDS) {
      const existing = this.db
        .select()
        .from(notificationProviders)
        .where(eq(notificationProviders.id, id))
        .get();
      if (existing) continue;
      this.db
        .insert(notificationProviders)
        .values({
          id,
          name: NOTIFICATION_PROVIDER_NAMES[id],
          enabled: false,
          config: defaultNotificationConfig(id),
          notificationTypes: allNotificationTypes,
        })
        .run();
    }
  }

  list(): NotificationProviderConfig[] {
    this.seed();
    return this.db
      .select()
      .from(notificationProviders)
      .all()
      .map(toConfig)
      .sort((a, b) => a.id - b.id);
  }

  find(id: NotificationProviderId): NotificationProviderConfig | undefined {
    this.seed();
    const row = this.db
      .select()
      .from(notificationProviders)
      .where(eq(notificationProviders.id, id))
      .get();
    return row ? toConfig(row) : undefined;
  }

  /** All ENABLED providers (used by the fan-out). */
  listEnabled(): NotificationProviderConfig[] {
    return this.list().filter((p) => p.enabled);
  }

  update(
    id: NotificationProviderId,
    patch: { enabled: boolean; config: NotificationConfig; notificationTypes: NotificationType[] },
  ): NotificationProviderConfig | undefined {
    this.seed();
    this.db
      .update(notificationProviders)
      .set({
        enabled: patch.enabled,
        config: { ...patch.config, id },
        notificationTypes: patch.notificationTypes,
      })
      .where(eq(notificationProviders.id, id))
      .run();
    return this.find(id);
  }
}
