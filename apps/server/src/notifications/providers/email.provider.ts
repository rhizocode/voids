import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  NotificationProviderId,
  emailConfigSchema,
  type EmailConfig,
  type NotificationType,
} from '@voids/shared';
import type { NotificationProvider } from './notification-provider.interface';
import { NOTIFICATION_TIMEOUT_MS } from './notification-provider.interface';
import type { NotificationLevel } from '../notification.service';

/**
 * Email (id 4). SMTP via nodemailer using the configured host/port/credentials
 * and TLS settings (gaps-reference §6 Email). Subject = title, text = body.
 */
@Injectable()
export class EmailProvider implements NotificationProvider<EmailConfig> {
  readonly id = NotificationProviderId.EMAIL;
  readonly name = 'Email';
  readonly configSchema = emailConfigSchema;

  isEnabled(config: EmailConfig): boolean {
    return Boolean(config.mailServer && config.mailFrom && config.mailTo);
  }

  async send(
    config: EmailConfig,
    _type: NotificationType,
    _level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    const transport = nodemailer.createTransport({
      host: config.mailServer,
      port: config.mailPort,
      // `secure` true => implicit TLS (465); otherwise STARTTLS upgrade when offered.
      secure: config.mailPort === 465,
      requireTLS: config.mailSmtpTlsEnabled,
      auth: config.mailSmtpAuth
        ? { user: config.username, pass: config.password }
        : undefined,
      connectionTimeout: NOTIFICATION_TIMEOUT_MS,
      greetingTimeout: NOTIFICATION_TIMEOUT_MS,
      socketTimeout: NOTIFICATION_TIMEOUT_MS,
    });

    try {
      await transport.sendMail({
        from: config.mailFrom,
        to: config.mailTo,
        subject: title,
        text: body,
      });
    } catch (err) {
      throw new Error(
        `${this.name} notification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      transport.close();
    }
  }
}
