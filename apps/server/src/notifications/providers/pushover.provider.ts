import { Injectable } from '@nestjs/common';
import {
  NotificationProviderId,
  pushOverConfigSchema,
  type NotificationType,
  type PushOverConfig,
} from '@voids/shared';
import type { NotificationProvider } from './notification-provider.interface';
import { postJson } from './notification-provider.interface';
import type { NotificationLevel } from '../notification.service';

/**
 * PushOver (id 5). `POST /1/messages.json` with token + user + title/message
 * and optional priority/sound/retry/expire (gaps-reference §6 PushOver).
 */
@Injectable()
export class PushOverProvider implements NotificationProvider<PushOverConfig> {
  readonly id = NotificationProviderId.PUSHOVER;
  readonly name = 'PushOver';
  readonly configSchema = pushOverConfigSchema;

  isEnabled(config: PushOverConfig): boolean {
    return Boolean(config.token && config.user);
  }

  async send(
    config: PushOverConfig,
    _type: NotificationType,
    _level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    await postJson(
      'https://api.pushover.net/1/messages.json',
      {
        token: config.token,
        user: config.user,
        priority: config.priority,
        sound: config.sound,
        title,
        message: body,
        retry: config.retry,
        expire: config.expire,
      },
      this.name,
    );
  }
}
