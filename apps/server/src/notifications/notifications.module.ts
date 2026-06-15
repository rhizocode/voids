import { Global, Module, OnModuleInit } from '@nestjs/common';
import { NotificationRepository } from '../db/repositories/notification.repository';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_PROVIDERS } from './notification.tokens';
import {
  DiscordProvider,
  EmailProvider,
  GotifyProvider,
  PushBulletProvider,
  PushOverProvider,
  SlackProvider,
  TelegramProvider,
  type NotificationProvider,
} from './providers';

const providerClasses = [
  TelegramProvider,
  PushBulletProvider,
  SlackProvider,
  GotifyProvider,
  EmailProvider,
  PushOverProvider,
  DiscordProvider,
];

/**
 * Notifications module (brief §11). Global so any feature module can inject
 * `NotificationService`. Registers all 7 providers behind the
 * `NOTIFICATION_PROVIDERS` token, the config repository, and the REST
 * controller; seeds the 7 provider rows on boot.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationRepository,
    ...providerClasses,
    {
      provide: NOTIFICATION_PROVIDERS,
      useFactory: (...providers: NotificationProvider[]) => providers,
      inject: providerClasses,
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(private readonly repo: NotificationRepository) {}

  onModuleInit(): void {
    this.repo.seed();
  }
}
