import { Injectable } from '@nestjs/common';
import {
  NotificationProviderId,
  pushBulletConfigSchema,
  type NotificationType,
  type PushBulletConfig,
} from '@voids/shared';
import type { NotificationProvider } from './notification-provider.interface';
import { postJson } from './notification-provider.interface';
import type { NotificationLevel } from '../notification.service';

/**
 * PushBullet (id 1). `POST /v2/pushes` as a `note`, access token in the
 * `Access-Token` header (gaps-reference §6 PushBullet).
 */
@Injectable()
export class PushBulletProvider implements NotificationProvider<PushBulletConfig> {
  readonly id = NotificationProviderId.PUSHBULLET;
  readonly name = 'PushBullet';
  readonly configSchema = pushBulletConfigSchema;

  isEnabled(config: PushBulletConfig): boolean {
    return Boolean(config.accessToken);
  }

  async send(
    config: PushBulletConfig,
    _type: NotificationType,
    _level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    await postJson(
      'https://api.pushbullet.com/v2/pushes',
      {
        type: 'note',
        channel_tag: config.channelTag,
        title,
        body,
      },
      this.name,
      { 'Access-Token': config.accessToken },
    );
  }
}
