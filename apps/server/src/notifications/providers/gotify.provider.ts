import { Injectable } from '@nestjs/common';
import {
  NotificationProviderId,
  gotifyConfigSchema,
  type GotifyConfig,
  type NotificationType,
} from '@voids/shared';
import type { NotificationProvider } from './notification-provider.interface';
import { postJson } from './notification-provider.interface';
import type { NotificationLevel } from '../notification.service';

/**
 * Gotify (id 3). `POST {address}/message?token={token}` with title + message
 * + priority (gaps-reference §6 Gotify).
 */
@Injectable()
export class GotifyProvider implements NotificationProvider<GotifyConfig> {
  readonly id = NotificationProviderId.GOTIFY;
  readonly name = 'Gotify';
  readonly configSchema = gotifyConfigSchema;

  isEnabled(config: GotifyConfig): boolean {
    return Boolean(config.address && config.token);
  }

  async send(
    config: GotifyConfig,
    _type: NotificationType,
    _level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    const base = config.address.replace(/\/+$/, '');
    const url = `${base}/message?token=${encodeURIComponent(config.token)}`;
    await postJson(
      url,
      {
        title,
        message: body,
        priority: config.priority,
      },
      this.name,
    );
  }
}
