import { Injectable } from '@nestjs/common';
import {
  NotificationProviderId,
  slackConfigSchema,
  type NotificationType,
  type SlackConfig,
} from '@voids/shared';
import type { NotificationProvider } from './notification-provider.interface';
import { postJson, escapeSlack } from './notification-provider.interface';
import type { NotificationLevel } from '../notification.service';

/**
 * Slack (id 2). POST a `blocks` section message to the incoming webhook URL
 * (gaps-reference §6 Slack).
 */
@Injectable()
export class SlackProvider implements NotificationProvider<SlackConfig> {
  readonly id = NotificationProviderId.SLACK;
  readonly name = 'Slack';
  readonly configSchema = slackConfigSchema;

  isEnabled(config: SlackConfig): boolean {
    return Boolean(config.webHookUrl);
  }

  async send(
    config: SlackConfig,
    _type: NotificationType,
    _level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    await postJson(
      config.webHookUrl,
      {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${escapeSlack(title)}*\n${escapeSlack(body)}`,
            },
          },
        ],
      },
      this.name,
    );
  }
}
