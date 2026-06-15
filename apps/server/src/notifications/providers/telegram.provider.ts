import { Injectable } from '@nestjs/common';
import {
  NotificationProviderId,
  telegramConfigSchema,
  type NotificationType,
  type TelegramConfig,
} from '@voids/shared';
import type { NotificationProvider } from './notification-provider.interface';
import { postJson } from './notification-provider.interface';
import type { NotificationLevel } from '../notification.service';

/**
 * Telegram (id 0). Bot API `sendMessage` with HTML parse mode (gaps-reference
 * §6 Telegram).
 */
@Injectable()
export class TelegramProvider implements NotificationProvider<TelegramConfig> {
  readonly id = NotificationProviderId.TELEGRAM;
  readonly name = 'Telegram';
  readonly configSchema = telegramConfigSchema;

  isEnabled(config: TelegramConfig): boolean {
    return Boolean(config.botId && config.chatId);
  }

  async send(
    config: TelegramConfig,
    _type: NotificationType,
    _level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    const url = `https://api.telegram.org/bot${config.botId}/sendMessage`;
    await postJson(
      url,
      {
        chat_id: config.chatId,
        text: `<strong>${title}</strong>\n${body}`,
        parse_mode: 'HTML',
      },
      this.name,
    );
  }
}
