import { Injectable } from '@nestjs/common';
import {
  NotificationProviderId,
  discordConfigSchema,
  type DiscordConfig,
  type NotificationType,
} from '@voids/shared';
import type { NotificationProvider } from './notification-provider.interface';
import { postJson } from './notification-provider.interface';
import type { NotificationLevel } from '../notification.service';

/**
 * Discord (id 6). POST an `embeds` payload (title + description) to the
 * incoming webhook URL (gaps-reference §6 Discord).
 */
@Injectable()
export class DiscordProvider implements NotificationProvider<DiscordConfig> {
  readonly id = NotificationProviderId.DISCORD;
  readonly name = 'Discord';
  readonly configSchema = discordConfigSchema;

  isEnabled(config: DiscordConfig): boolean {
    return Boolean(config.webHookUrl);
  }

  async send(
    config: DiscordConfig,
    _type: NotificationType,
    _level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    await postJson(
      config.webHookUrl,
      {
        embeds: [
          {
            title,
            description: body,
          },
        ],
      },
      this.name,
    );
  }
}
