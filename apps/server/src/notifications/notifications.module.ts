import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';

/**
 * Notification hook-point module (brief §11). Global so any feature module can
 * inject `NotificationService` without re-importing — Phase 5 will add the
 * providers, config, and controllers here behind the same service.
 */
@Global()
@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
